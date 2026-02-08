"""
Soccer-Brain 예측 API 서버
===========================
XGBoost 모델을 사용한 승무패 예측

사용법:
  pip install flask xgboost pandas numpy
  python scripts/predict_server.py
"""

import os
import json
from flask import Flask, request, jsonify
import xgboost as xgb
import numpy as np

app = Flask(__name__)

# 모델 경로 - V8 최신 모델 사용
MODEL_DIR = os.path.join(os.path.dirname(__file__), '..', 'models')
MODEL_PATH = os.path.join(MODEL_DIR, 'xgboost_v8_latest.json')
META_PATH = os.path.join(MODEL_DIR, 'xgboost_v8_latest_meta.json')

# 전역 모델 (서버 시작 시 로드)
model = None
meta = None


def load_model():
    """모델 로드"""
    global model, meta
    
    print(f"📂 모델 로딩: {MODEL_PATH}")
    
    if not os.path.exists(MODEL_PATH):
        print(f"❌ 모델 파일 없음: {MODEL_PATH}")
        return False
    
    # XGBoost 모델 로드
    model = xgb.XGBClassifier()
    model.load_model(MODEL_PATH)
    
    # 메타데이터 로드
    with open(META_PATH, 'r', encoding='utf-8') as f:
        meta = json.load(f)
    
    print(f"✅ 모델 로드 완료!")
    print(f"   - 정확도: {meta['accuracy']:.1%}")
    print(f"   - 클래스: {meta['classes']}")
    print(f"   - 피처 수: {len(meta['feature_columns'])}")
    
    return True


@app.route('/health', methods=['GET'])
def health():
    """헬스체크"""
    return jsonify({
        'status': 'ok',
        'model_loaded': model is not None,
        'accuracy': meta['accuracy'] if meta else None
    })


@app.route('/predict', methods=['POST'])
def predict():
    """단일 경기 예측"""
    if model is None:
        return jsonify({'error': 'Model not loaded'}), 500
    
    data = request.json
    
    # 피처 준비
    features = []
    for col in meta['feature_columns']:
        val = data.get(col, 0)
        if val is None:
            val = 0
        features.append(float(val))
    
    X = np.array([features])
    
    # 예측
    proba = model.predict_proba(X)[0]
    pred_class = model.predict(X)[0]
    
    # 클래스별 확률
    # classes: ['away_win', 'draw', 'home_win']
    result = {
        'prediction': meta['classes'][pred_class],
        'probabilities': {
            meta['classes'][i]: round(float(proba[i]) * 100, 1)
            for i in range(len(meta['classes']))
        }
    }
    
    return jsonify(result)


@app.route('/predict/batch', methods=['POST'])
def predict_batch():
    """여러 경기 일괄 예측"""
    if model is None:
        return jsonify({'error': 'Model not loaded'}), 500
    
    data = request.json
    fixtures = data.get('fixtures', [])
    
    if not fixtures:
        return jsonify({'error': 'No fixtures provided'}), 400
    
    # 디버깅: 첫 번째 경기 피처 출력
    if fixtures:
        print(f"\n📥 받은 경기 수: {len(fixtures)}")
        fx0 = fixtures[0]
        print(f"📊 첫 경기 ID: {fx0.get('fixtureId')}")
        print(f"   home_form_last5: {fx0.get('home_form_last5')}")
        print(f"   away_form_last5: {fx0.get('away_form_last5')}")
        print(f"   home_xg_avg: {fx0.get('home_xg_avg')}")
        print(f"   home_wins_atHome_pct: {fx0.get('home_wins_atHome_pct')}")
        print(f"   shotsTotal_diff: {fx0.get('shotsTotal_diff')}")
    
    results = []
    
    for fx in fixtures:
        fixture_id = fx.get('fixtureId')
        
        # V8 피처 매핑 (routes.ts → V8 모델)
        mapped = {
            # 폼 (직접 매핑)
            'home_form_last3': fx.get('home_form_last3', 0) or 0,
            'home_form_last5': fx.get('home_form_last5', 0) or 0,
            'away_form_last3': fx.get('away_form_last3', 0) or 0,
            'away_form_last5': fx.get('away_form_last5', 0) or 0,
            # 폼 (계산)
            'form_diff_last3': (fx.get('home_form_last3', 0) or 0) - (fx.get('away_form_last3', 0) or 0),
            'form_diff_last5': (fx.get('home_form_last5', 0) or 0) - (fx.get('away_form_last5', 0) or 0),
            'home_form_trend': (fx.get('home_form_last3', 0) or 0) - (fx.get('home_form_last5', 0) or 0),
            'away_form_trend': (fx.get('away_form_last3', 0) or 0) - (fx.get('away_form_last5', 0) or 0),
            
            # xG (직접 매핑)
            'home_xg_avg': fx.get('home_xg_avg', 0) or 0,
            'away_xg_avg': fx.get('away_xg_avg', 0) or 0,
            'home_xg_atHome_avg': fx.get('home_xg_atHome_avg', 0) or 0,
            'away_xg_atAway_avg': fx.get('away_xg_atAway_avg', 0) or 0,
            'xg_diff': fx.get('xg_diff', 0) or 0,
            # xG (계산)
            'xg_home_diff': (fx.get('home_xg_atHome_avg', 0) or 0) - (fx.get('away_xg_atAway_avg', 0) or 0),
            'home_xg_overperform': (fx.get('home_goalsFor_avg', 0) or 0) - (fx.get('home_xg_avg', 0) or 0),
            'away_xg_overperform': (fx.get('away_goalsFor_avg', 0) or 0) - (fx.get('away_xg_avg', 0) or 0),
            
            # 득실 (직접 매핑)
            'home_goalsFor_avg': fx.get('home_goalsFor_avg', 0) or 0,
            'away_goalsFor_avg': fx.get('away_goalsFor_avg', 0) or 0,
            'home_goalsAgainst_avg': fx.get('home_goalsAgainst_avg', 0) or 0,
            'away_goalsAgainst_avg': fx.get('away_goalsAgainst_avg', 0) or 0,
            'home_goalsFor_atHome_avg': fx.get('home_goalsFor_atHome_avg', 0) or 0,
            'away_goalsFor_atAway_avg': fx.get('away_goalsFor_atAway_avg', 0) or 0,
            # 득실 (이름 매핑)
            'goals_diff': fx.get('goalsFor_diff', 0) or 0,
            'goals_against_diff': (fx.get('home_goalsAgainst_avg', 0) or 0) - (fx.get('away_goalsAgainst_avg', 0) or 0),
            
            # 홈/원정 승률
            'home_wins_atHome_pct': fx.get('home_wins_atHome_pct', 0) or 0,
            'away_wins_atAway_pct': fx.get('away_wins_atAway_pct', 0) or 0,
            'home_away_winrate_diff': (fx.get('home_wins_atHome_pct', 0) or 0) - (fx.get('away_wins_atAway_pct', 0) or 0),
            
            # 슈팅 (이름 매핑)
            'home_shotsTotal_avg': fx.get('home_shotsTotal_avg', 0) or 0,
            'away_shotsTotal_avg': fx.get('away_shotsTotal_avg', 0) or 0,
            'shots_diff': fx.get('shotsTotal_diff', 0) or 0,
            'shots_on_target_diff': fx.get('shotsOnTarget_diff', 0) or 0,
            'shot_accuracy_diff': 0,  # 기본값
            
            # 피로도
            'home_days_rest': fx.get('home_days_rest', 0) or 0,
            'away_days_rest': fx.get('away_days_rest', 0) or 0,
            'rest_diff': fx.get('rest_diff', 0) or 0,
            'rest_diff_normalized': min(max((fx.get('rest_diff', 0) or 0) / 7, -1), 1),
            'fatigue_diff': (fx.get('home_matches_14d', 0) or 0) - (fx.get('away_matches_14d', 0) or 0),
            
            # H2H
            'h2h_total_matches': fx.get('h2h_total_matches', 0) or 0,
            'h2h_home_win_pct': fx.get('h2h_home_win_pct', 0) or 0,
            'h2h_reliability': min((fx.get('h2h_total_matches', 0) or 0) / 10, 1),
            'h2h_home_advantage': (fx.get('h2h_home_win_pct', 0) or 50) - 50,
            
            # 점유율/패스 (이름 매핑)
            'home_possessionPct_avg': fx.get('home_possessionPct_avg', 0) or 0,
            'away_possessionPct_avg': fx.get('away_possessionPct_avg', 0) or 0,
            'possession_diff': fx.get('possessionPct_diff', 0) or 0,
            'pass_accuracy_diff': (fx.get('home_passAccuracyPct_avg', 0) or 0) - (fx.get('away_passAccuracyPct_avg', 0) or 0),
            
            # 부상
            'homeInjuryCount': fx.get('homeInjuryCount', 0) or 0,
            'awayInjuryCount': fx.get('awayInjuryCount', 0) or 0,
        }
        
        # 피처 준비 (메타에 정의된 순서대로)
        features = []
        for col in meta['feature_columns']:
            val = mapped.get(col, 0)
            if val is None:
                val = 0
            features.append(float(val))
        
        X = np.array([features])
        
        # 예측
        proba = model.predict_proba(X)[0]
        
        # classes: ['away_win', 'draw', 'home_win'] 순서
        results.append({
            'fixtureId': fixture_id,
            'homeProb': round(float(proba[2]) * 100, 1),  # home_win
            'drawProb': round(float(proba[1]) * 100, 1),  # draw
            'awayProb': round(float(proba[0]) * 100, 1),  # away_win
        })
    
    return jsonify({
        'ok': True,
        'predictions': results,
        'model_accuracy': meta.get('accuracy', 0)
    })


@app.route('/model/info', methods=['GET'])
def model_info():
    """모델 정보"""
    if meta is None:
        return jsonify({'error': 'Model not loaded'}), 500
    
    return jsonify({
        'accuracy': meta['accuracy'],
        'classes': meta['classes'],
        'feature_columns': meta['feature_columns'],
        'created_at': meta['created_at']
    })


if __name__ == '__main__':
    if load_model():
        print("\n🚀 예측 서버 시작: http://localhost:5001")
        print("   POST /predict - 단일 예측")
        print("   POST /predict/batch - 일괄 예측")
        print("   GET /health - 헬스체크")
        print("   GET /model/info - 모델 정보\n")
        app.run(host='0.0.0.0', port=5001, debug=False)
    else:
        print("❌ 모델 로드 실패. 서버 시작 불가.")
