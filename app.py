import sqlite3
import datetime
from flask import Flask, render_template, jsonify, request
from game_manager import GameManager

app = Flask(__name__)
gm = GameManager()

# UID 對照表
RFID_MAP = {
    "838785758715": "red",
    "83997912920": "blue",
    "83108261766": "yellow",
    "120454803410": "green"
}

DB_NAME = "game_history.db"

def init_db():
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS history 
                 (id INTEGER PRIMARY KEY AUTOINCREMENT, 
                  timestamp TEXT, player_name TEXT, team TEXT, 
                  score INTEGER, alcohol_ml INTEGER, soda_ml INTEGER)''')
    conn.commit()
    conn.close()

init_db()

def save_game_result_to_db(players):
    try:
        conn = sqlite3.connect(DB_NAME)
        c = conn.cursor()
        now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        for p in players:
            c.execute("INSERT INTO history (timestamp, player_name, team, score, alcohol_ml, soda_ml) VALUES (?, ?, ?, ?, ?, ?)",
                      (now, p['name'], p['team'], p['score'], p.get('current_alcohol', 0), p.get('current_soda', 0)))
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"DB Error: {e}")

@app.route('/')
def index():
    return render_template('game_stage.html')

@app.route('/rfid_login', methods=['POST'])
def rfid_login():
    data = request.json
    uid = str(data.get('uid'))
    if gm.state in ['LOBBY', 'WAITING_FOR_NAME']:
        if uid in RFID_MAP:
            team = RFID_MAP[uid]
            if gm.add_player(uid, team):
                return jsonify({"status": "ok", "action": "login", "team": team})
            return jsonify({"status": "error", "message": "Exists"})
        return jsonify({"status": "error", "message": "Unknown Card"})
    elif gm.state == 'DISPENSING_DRINKS':
        if gm.scan_cup_for_dispensing(uid):
             return jsonify({"status": "ok", "action": "dispense"})
        return jsonify({"status": "error", "message": "Error Cup"})
    return jsonify({"status": "ignore"})

@app.route('/submit_name', methods=['POST'])
def submit_name():
    if gm.submit_name(request.json.get('name')): return jsonify({"status": "ok"})
    return jsonify({"status": "error"})

@app.route('/start_game', methods=['POST'])
def start_game():
    if gm.start_game(): return jsonify({"status": "ok"})
    return jsonify({"status": "error"})

@app.route('/game_update')
def game_update():
    return jsonify(gm.get_state())

@app.route('/submit_action', methods=['POST'])
def submit_action():
    data = request.json
    action = data.get('action')
    # Game 1
    if gm.state == "GAME_1_DICE":
        if action == 'roll': return jsonify({"status": "ok", "data": gm.roll_dice()})
        elif action == 'next': gm.next_player_dice(); return jsonify({"status": "ok"})
    # Game 2
    elif gm.state == "VOCAB_SELECT_TOPIC":
        if action == 'select_topic': gm.vocab_select_topic(data.get('topic')); return jsonify({"status": "ok"})
    elif gm.state == "VOCAB_THINKING":
        if action == 'submit_answer': gm.vocab_submit_answer(data.get('player_id'), data.get('answer')); return jsonify({"status": "ok"})
        elif action == 'finish_thinking': gm.vocab_finish_thinking(); return jsonify({"status": "ok"})
    elif gm.state == "VOCAB_JUDGING":
        if action == 'judge': gm.vocab_judge(data.get('results')); return jsonify({"status": "ok"})
    # Game 3
    elif gm.state == "POKER_BET_CHOICE":
        if action == 'bet': gm.poker_bet(data.get('bet')); return jsonify({"status": "ok"})
    elif gm.state == "GAME_3_POKER":
        if action == 'draw': return jsonify({"status": "ok", "data": gm.draw_third_card()})
        elif action == 'next':
            finished = gm.next_player_poker()
            if finished: save_game_result_to_db(gm.players)
            return jsonify({"status": "ok"})
    return jsonify({"status": "error"})

@app.route('/start_dispensing', methods=['POST'])
def start_dispensing():
    gm.start_dispensing_phase()
    return jsonify({"status": "ok"})

# [New] 暫停按鈕 API
@app.route('/toggle_pause', methods=['POST'])
def toggle_pause():
    is_paused = gm.toggle_pause()
    return jsonify({"status": "ok", "is_paused": is_paused})

@app.route('/reset_game', methods=['POST'])
def reset_game():
    if request.json.get('type') == 'soft': gm.restart_game_soft()
    else: gm.reset_game_hard()
    return jsonify({"status": "ok"})

@app.route('/test_login/<color>')
def test_login(color):
    mock = {"red": "838785758715", "blue": "83997912920", "yellow": "83108261766", "green": "120454803410"}
    if gm.add_player(mock.get(color, "00"), color): return jsonify({"status": "ok"})
    return jsonify({"status": "error"})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
