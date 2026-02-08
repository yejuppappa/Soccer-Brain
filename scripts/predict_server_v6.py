"""
Soccer-Brain V6 예측 서버
=========================
V6 모델 + 실시간 피처 변환 지원

사용법:
  python scripts/predict_server_v6.py
"""

import os
import json
from flask import Flask, request, jsonify
from flask_cors import CORS
import xgboost as xgb
import numpy as np

app = Flask(__name__)
CORS(app)

# 모델 로드 (V6.1 > V6 > V5 순서로 시도)
MODEL_DIR = os.path.join(os.path.dirname(__file__), '..', 'models')

v6_1_model_path = os.path.join(MODEL_DIR, 'xgboost_v6_1_latest.json')
v6_model_path = os.path.join(MODEL_DIR, 'xgboost_v6_latest.json')
v5_model_path = os.path.join(MODEL_DIR, 'xgboost_1x2_latest.json')

if os.path.exists(v6_1_model_path):
    model_path = v6_1_model_path
    meta_path = os.path.join(MODEL_DIR, 'xgboost_v6_1_latest_meta.json')
    MODEL_VERSION = "V6.1"
elif os.path.exists(v6_model_path):
    model_path = v6_model_path
    meta_path = os.path.join(MODEL_DIR, 'xgboost_v6_latest_meta.json')
    MODEL_VERSION = "V6"
else:
    model_path = v5_model_path
    meta_path = os.path.join(MODEL_DIR, 'xgboost_1x2_latest_meta.json')
    MODEL_VERSION = "V5"

print(f"📂 모델 로딩: {model_path}")

model = xgb.XGBClassifier()
model.load_model(model_path)

with open(meta_path, 'r') as f:
    meta = json.load(f)

CLASSES = meta['classes']  # ['away_win', 'draw', 'home_win']
FEATURE_COLS = meta['feature_columns']

print(f"✅ {MODEL_VERSION} 모델 로드 완료!")
print(f"   - 정확도: {meta['accuracy']*100:.1f}%")
print(f"   - 클래스: {CLASSES}")
print(f"   - 피처 수: {len(FEATURE_COLS)}")


def create_v6_derived_features(features: dict) -> dict:
    """V6/V6.1 파생 피처 생성 (실시간)"""
    
    # 안전한 값 가져오기
    def safe_get(key, default=0):
        val = features.get(key, default)
        if val is None:
            return default
        return float(val)
    
    # 1. 팀 강도
    home_xg = safe_get('home_xg_avg', 1)
    away_xg = safe_get('away_xg_avg', 1)
    home_goals = safe_get('home_goalsFor_avg', 1)
    away_goals = safe_get('away_goalsFor_avg', 1)
    home_wins_pct = safe_get('home_wins_atHome_pct', 40)
    away_wins_pct = safe_get('away_wins_atAway_pct', 30)
    
    features['home_team_strength'] = (home_xg/3 + home_goals/3 + home_wins_pct/100) / 3
    features['away_team_strength'] = (away_xg/3 + away_goals/3 + away_wins_pct/100) / 3
    features['team_strength_diff'] = features['home_team_strength'] - features['away_team_strength']
    
    # 2. 조정된 홈 어드벤티지
    features['adjusted_home_advantage'] = (home_wins_pct / 100) * features['home_team_strength']
    features['adjusted_away_strength'] = (away_wins_pct / 100) * features['away_team_strength']
    features['home_away_advantage_diff'] = features['adjusted_home_advantage'] - features['adjusted_away_strength']
    
    # 3. 시간 가중 폼
    home_form3 = safe_get('home_form_last3', 1)
    home_form5 = safe_get('home_form_last5', 1)
    away_form3 = safe_get('away_form_last3', 1)
    away_form5 = safe_get('away_form_last5', 1)
    
    features['home_weighted_form'] = 0.6 * home_form3 + 0.4 * home_form5
    features['away_weighted_form'] = 0.6 * away_form3 + 0.4 * away_form5
    features['weighted_form_diff'] = features['home_weighted_form'] - features['away_weighted_form']
    
    # 4. 모멘텀
    features['home_momentum'] = 1 if home_form3 >= 2.0 else (-1 if home_form3 <= 0.5 else 0)
    features['away_momentum'] = 1 if away_form3 >= 2.0 else (-1 if away_form3 <= 0.5 else 0)
    features['momentum_diff'] = features['home_momentum'] - features['away_momentum']
    
    # 5. H2H 조정
    h2h_matches = safe_get('h2h_total_matches', 0)
    h2h_weight = min(h2h_matches / 4, 1)
    h2h_home_win_pct = safe_get('h2h_home_win_pct', 50)
    
    features['h2h_confidence'] = h2h_weight  # V6.1 신규
    features['h2h_weighted_home_win_pct'] = h2h_home_win_pct * h2h_weight + 50 * (1 - h2h_weight)
    features['form_vs_h2h_balance'] = 0.7 * features['weighted_form_diff'] + 0.3 * (features['h2h_weighted_home_win_pct'] - 50) / 50
    
    # 6. 공격력/수비력 지표
    home_shots = safe_get('home_shotsOnTarget_avg', 4)
    away_shots = safe_get('away_shotsOnTarget_avg', 4)
    home_against = safe_get('home_goalsAgainst_avg', 1.5)
    away_against = safe_get('away_goalsAgainst_avg', 1.5)
    
    features['home_attack_index'] = (home_xg + home_goals + home_shots/4) / 3
    features['away_attack_index'] = (away_xg + away_goals + away_shots/4) / 3
    features['home_defense_index'] = 2 - home_against
    features['away_defense_index'] = 2 - away_against
    features['attack_index_diff'] = features['home_attack_index'] - features['away_attack_index']
    features['defense_index_diff'] = features['home_defense_index'] - features['away_defense_index']
    
    # 7. 매치업 타입 (V6.1 신규)
    # 강팀 vs 약팀 매치업: 임계값 기반 (0.4 이상 = 강팀, 0.25 이하 = 약팀)
    home_strong = features['home_team_strength'] >= 0.4
    away_strong = features['away_team_strength'] >= 0.4
    home_weak = features['home_team_strength'] <= 0.25
    away_weak = features['away_team_strength'] <= 0.25
    
    if home_strong and away_weak:
        features['matchup_type'] = 1  # 홈 강팀 vs 원정 약팀
    elif away_strong and home_weak:
        features['matchup_type'] = -1  # 홈 약팀 vs 원정 강팀
    else:
        features['matchup_type'] = 0  # 비슷한 수준
    
    return features


def prepare_features_for_prediction(raw_features: dict) -> list:
    """예측용 피처 벡터 생성"""
    
    # V6/V6.1 파생 피처 생성
    if MODEL_VERSION in ["V6", "V6.1"]:
        raw_features = create_v6_derived_features(raw_features)
    
    # 피처 컬럼 순서대로 추출
    feature_vector = []
    for col in FEATURE_COLS:
        val = raw_features.get(col, 0)
        if val is None:
            val = 0
        feature_vector.append(float(val))
    
    return feature_vector


@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'ok',
        'model_version': MODEL_VERSION,
        'accuracy': meta['accuracy'],
        'feature_count': len(FEATURE_COLS)
    })


@app.route('/model/info', methods=['GET'])
def model_info():
    return jsonify({
        'version': MODEL_VERSION,
        'accuracy': meta['accuracy'],
        'classes': CLASSES,
        'features': FEATURE_COLS,
        'created_at': meta.get('created_at', 'unknown'),
        'improvements': meta.get('improvements', [])
    })


@app.route('/predict', methods=['POST'])
def predict():
    """단일 경기 예측"""
    try:
        data = request.get_json()
        features = data.get('features', {})
        
        # 피처 준비
        feature_vector = prepare_features_for_prediction(features)
        X = np.array([feature_vector])
        
        # 예측
        proba = model.predict_proba(X)[0]
        
        # 클래스 순서: ['away_win', 'draw', 'home_win']
        return jsonify({
            'ok': True,
            'model_version': MODEL_VERSION,
            'prediction': {
                'home_win': float(proba[2]) * 100,
                'draw': float(proba[1]) * 100,
                'away_win': float(proba[0]) * 100,
            }
        })
        
    except Exception as e:
        return jsonify({'ok': False, 'error': str(e)}), 500


@app.route('/predict/batch', methods=['POST'])
def predict_batch():
    """배치 예측"""
    try:
        data = request.get_json()
        fixtures = data.get('fixtures', [])
        
        if not fixtures:
            return jsonify({'ok': True, 'predictions': []})
        
        # 피처 준비
        X = []
        fixture_ids = []
        
        for fx in fixtures:
            fixture_id = fx.get('fixtureId')
            fixture_ids.append(fixture_id)
            
            # V5/V6 피처 추출
            raw_features = {}
            for key in fx:
                if key != 'fixtureId':
                    raw_features[key] = fx[key]
            
            feature_vector = prepare_features_for_prediction(raw_features)
            X.append(feature_vector)
        
        X = np.array(X)
        
        # 배치 예측
        proba = model.predict_proba(X)
        
        # 결과 구성
        predictions = []
        for i, fx_id in enumerate(fixture_ids):
            predictions.append({
                'fixtureId': fx_id,
                'home_win': float(proba[i][2]) * 100,
                'draw': float(proba[i][1]) * 100,
                'away_win': float(proba[i][0]) * 100,
            })
        
        return jsonify({
            'ok': True,
            'model_version': MODEL_VERSION,
            'predictions': predictions
        })
        
    except Exception as e:
        return jsonify({'ok': False, 'error': str(e)}), 500


if __name__ == '__main__':
    print(f"""
🚀 {MODEL_VERSION} 예측 서버 시작: http://localhost:5001
   POST /predict - 단일 예측
   POST /predict/batch - 일괄 예측
   GET /health - 헬스체크
   GET /model/info - 모델 정보
""")
    app.run(host='0.0.0.0', port=5001, debug=False)
