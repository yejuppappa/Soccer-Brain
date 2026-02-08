"""
Football-data.co.uk 배당 CSV → DB import
==========================================

사용법:
  python scripts/import_odds_csv.py
"""

import os
import csv
from datetime import datetime
from decimal import Decimal

import psycopg2
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

# CSV 파일과 리그 매핑 (6시즌)
CSV_FILES = {
    # 20/21 시즌
    "E0_2021.csv": {"name": "Premier League", "country": "England", "apiLeagueId": 39},
    "SP1_2021.csv": {"name": "La Liga", "country": "Spain", "apiLeagueId": 140},
    "I1_2021.csv": {"name": "Serie A", "country": "Italy", "apiLeagueId": 135},
    "D1_2021.csv": {"name": "Bundesliga", "country": "Germany", "apiLeagueId": 78},
    "F1_2021.csv": {"name": "Ligue 1", "country": "France", "apiLeagueId": 61},
    # 21/22 시즌
    "E0_2122.csv": {"name": "Premier League", "country": "England", "apiLeagueId": 39},
    "SP1_2122.csv": {"name": "La Liga", "country": "Spain", "apiLeagueId": 140},
    "I1_2122.csv": {"name": "Serie A", "country": "Italy", "apiLeagueId": 135},
    "D1_2122.csv": {"name": "Bundesliga", "country": "Germany", "apiLeagueId": 78},
    "F1_2122.csv": {"name": "Ligue 1", "country": "France", "apiLeagueId": 61},
    # 22/23 시즌
    "E0_2223.csv": {"name": "Premier League", "country": "England", "apiLeagueId": 39},
    "SP1_2223.csv": {"name": "La Liga", "country": "Spain", "apiLeagueId": 140},
    "I1_2223.csv": {"name": "Serie A", "country": "Italy", "apiLeagueId": 135},
    "D1_2223.csv": {"name": "Bundesliga", "country": "Germany", "apiLeagueId": 78},
    "F1_2223.csv": {"name": "Ligue 1", "country": "France", "apiLeagueId": 61},
    # 23/24 시즌
    "E0_2324.csv": {"name": "Premier League", "country": "England", "apiLeagueId": 39},
    "SP1_2324.csv": {"name": "La Liga", "country": "Spain", "apiLeagueId": 140},
    "I1_2324.csv": {"name": "Serie A", "country": "Italy", "apiLeagueId": 135},
    "D1_2324.csv": {"name": "Bundesliga", "country": "Germany", "apiLeagueId": 78},
    "F1_2324.csv": {"name": "Ligue 1", "country": "France", "apiLeagueId": 61},
    # 24/25 시즌
    "E0_2425.csv": {"name": "Premier League", "country": "England", "apiLeagueId": 39},
    "SP1_2425.csv": {"name": "La Liga", "country": "Spain", "apiLeagueId": 140},
    "I1_2425.csv": {"name": "Serie A", "country": "Italy", "apiLeagueId": 135},
    "D1_2425.csv": {"name": "Bundesliga", "country": "Germany", "apiLeagueId": 78},
    "F1_2425.csv": {"name": "Ligue 1", "country": "France", "apiLeagueId": 61},
    # 25/26 시즌
    "E0_2526.csv": {"name": "Premier League", "country": "England", "apiLeagueId": 39},
    "SP1_2526.csv": {"name": "La Liga", "country": "Spain", "apiLeagueId": 140},
    "I1_2526.csv": {"name": "Serie A", "country": "Italy", "apiLeagueId": 135},
    "D1_2526.csv": {"name": "Bundesliga", "country": "Germany", "apiLeagueId": 78},
    "F1_2526.csv": {"name": "Ligue 1", "country": "France", "apiLeagueId": 61},
}

# 팀명 매핑 (CSV → DB)
TEAM_NAME_MAP = {
    # EPL
    "Man United": "Manchester United",
    "Man City": "Manchester City",
    "Nott'm Forest": "Nottingham Forest",
    "Nottingham": "Nottingham Forest",
    "Newcastle": "Newcastle United",
    "Tottenham": "Tottenham Hotspur",
    "West Ham": "West Ham United",
    "Wolves": "Wolverhampton Wanderers",
    "Sheffield United": "Sheffield Utd",
    "Luton": "Luton Town",
    
    # La Liga
    "Ath Bilbao": "Athletic Club",
    "Ath Madrid": "Atletico Madrid",
    "Betis": "Real Betis",
    "Cadiz": "Cadiz CF",
    "Celta": "Celta Vigo",
    "Espanol": "Espanyol",
    "Mallorca": "RCD Mallorca",
    "Sociedad": "Real Sociedad",
    "Vallecano": "Rayo Vallecano",
    
    # Serie A
    "Inter": "Inter Milan",
    "Milan": "AC Milan",
    "Verona": "Hellas Verona",
    
    # Bundesliga
    "Augsburg": "FC Augsburg",
    "Bayern Munich": "Bayern München",
    "Dortmund": "Borussia Dortmund",
    "Ein Frankfurt": "Eintracht Frankfurt",
    "FC Koln": "FC Köln",
    "Hoffenheim": "TSG Hoffenheim",
    "Leverkusen": "Bayer Leverkusen",
    "M'gladbach": "Borussia Mönchengladbach",
    "Mainz": "Mainz 05",
    "Stuttgart": "VfB Stuttgart",
    "Union Berlin": "Union Berlin",
    "Wolfsburg": "VfL Wolfsburg",
    "Werder Bremen": "SV Werder Bremen",
    "Bochum": "VfL Bochum",
    "Darmstadt": "SV Darmstadt 98",
    "Heidenheim": "1. FC Heidenheim",
    "RB Leipzig": "RB Leipzig",
    "Freiburg": "SC Freiburg",
    
    # Ligue 1
    "Paris SG": "Paris Saint-Germain",
    "Paris Saint Germain": "Paris Saint-Germain",
}


def normalize_team_name(name):
    """팀명 정규화"""
    return TEAM_NAME_MAP.get(name, name)


def parse_date(date_str):
    """날짜 파싱 (DD/MM/YYYY 또는 DD/MM/YY)"""
    for fmt in ["%d/%m/%Y", "%d/%m/%y"]:
        try:
            return datetime.strptime(date_str, fmt)
        except ValueError:
            continue
    return None


def get_fixture_by_teams_and_date(cursor, home_team, away_team, match_date, league_id):
    """팀명과 날짜로 fixture 찾기"""
    
    # 날짜 범위 (±1일)
    date_from = match_date.replace(hour=0, minute=0, second=0)
    date_to = match_date.replace(hour=23, minute=59, second=59)
    
    query = """
    SELECT f.id, f."apiFixtureId", ht.name as home_name, at.name as away_name
    FROM "Fixture" f
    JOIN "Team" ht ON f."homeTeamId" = ht.id
    JOIN "Team" at ON f."awayTeamId" = at.id
    JOIN "League" l ON f."leagueId" = l.id
    WHERE l."apiLeagueId" = %s
      AND f."kickoffAt" >= %s
      AND f."kickoffAt" <= %s
      AND (
        (LOWER(ht.name) LIKE LOWER(%s) OR LOWER(%s) LIKE CONCAT('%%', LOWER(ht.name), '%%'))
        AND
        (LOWER(at.name) LIKE LOWER(%s) OR LOWER(%s) LIKE CONCAT('%%', LOWER(at.name), '%%'))
      )
    LIMIT 1
    """
    
    home_pattern = f"%{home_team}%"
    away_pattern = f"%{away_team}%"
    
    cursor.execute(query, (
        league_id,
        date_from,
        date_to,
        home_pattern, home_team,
        away_pattern, away_team
    ))
    
    return cursor.fetchone()


def import_csv(conn, csv_path, league_info):
    """CSV 파일 import"""
    
    cursor = conn.cursor()
    
    imported = 0
    skipped = 0
    not_found = 0
    errors = 0
    
    with open(csv_path, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        
        for row in reader:
            try:
                # 필수 필드 확인
                if not row.get('Date') or not row.get('HomeTeam') or not row.get('AwayTeam'):
                    skipped += 1
                    continue
                
                # 배당 필드 확인 (B365 = Bet365)
                home_odds = row.get('B365H') or row.get('PSH') or row.get('BWH')
                draw_odds = row.get('B365D') or row.get('PSD') or row.get('BWD')
                away_odds = row.get('B365A') or row.get('PSA') or row.get('BWA')
                
                if not home_odds or not draw_odds or not away_odds:
                    skipped += 1
                    continue
                
                # 날짜 파싱
                match_date = parse_date(row['Date'])
                if not match_date:
                    skipped += 1
                    continue
                
                # 팀명 정규화
                home_team = normalize_team_name(row['HomeTeam'])
                away_team = normalize_team_name(row['AwayTeam'])
                
                # Fixture 찾기
                fixture = get_fixture_by_teams_and_date(
                    cursor, 
                    home_team, 
                    away_team, 
                    match_date,
                    league_info['apiLeagueId']
                )
                
                if not fixture:
                    not_found += 1
                    # print(f"  Not found: {row['Date']} {home_team} vs {away_team}")
                    continue
                
                fixture_id = fixture[0]
                
                # 배당 upsert
                cursor.execute("""
                    INSERT INTO "FixtureOdds" ("fixtureId", "home", "draw", "away", "bookmaker", "fetchedAt")
                    VALUES (%s, %s, %s, %s, %s, NOW())
                    ON CONFLICT ("fixtureId") 
                    DO UPDATE SET 
                        "home" = EXCLUDED."home",
                        "draw" = EXCLUDED."draw",
                        "away" = EXCLUDED."away",
                        "bookmaker" = EXCLUDED."bookmaker",
                        "fetchedAt" = NOW()
                """, (
                    fixture_id,
                    Decimal(home_odds),
                    Decimal(draw_odds),
                    Decimal(away_odds),
                    "Bet365"
                ))
                
                imported += 1
                
            except Exception as e:
                errors += 1
                print(f"  Error: {e}")
    
    conn.commit()
    cursor.close()
    
    return imported, skipped, not_found, errors


def main():
    print("=" * 50)
    print("⚽ 배당 CSV Import")
    print("=" * 50)
    
    conn = psycopg2.connect(DATABASE_URL)
    
    data_dir = os.path.join(os.path.dirname(__file__), '..', 'data')
    
    total_imported = 0
    total_not_found = 0
    
    for filename, league_info in CSV_FILES.items():
        csv_path = os.path.join(data_dir, filename)
        
        if not os.path.exists(csv_path):
            print(f"\n⚠️  {filename} 없음 - 건너뜀")
            continue
        
        print(f"\n📂 {league_info['name']} ({filename})")
        
        imported, skipped, not_found, errors = import_csv(conn, csv_path, league_info)
        
        print(f"   ✅ Imported: {imported}")
        print(f"   ⏭️  Skipped: {skipped}")
        print(f"   ❓ Not found: {not_found}")
        print(f"   ❌ Errors: {errors}")
        
        total_imported += imported
        total_not_found += not_found
    
    conn.close()
    
    print("\n" + "=" * 50)
    print(f"✅ 총 {total_imported}개 배당 데이터 import 완료!")
    print(f"❓ 매칭 실패: {total_not_found}개")
    print("=" * 50)


if __name__ == "__main__":
    main()
