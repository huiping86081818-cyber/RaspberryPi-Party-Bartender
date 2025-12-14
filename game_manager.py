import random
import time
import threading
import uuid

try:
    import RPi.GPIO as GPIO
    GPIO_AVAILABLE = True
except ImportError:
    GPIO_AVAILABLE = False
    print("⚠️  Running in Mock GPIO Mode")

class GameManager:
    def __init__(self):
        self.PIN_PUMP_SODA = 17
        self.PIN_PUMP_ALCOHOL = 27
        
        # [New] 控制旗標
        self.is_paused = False    # 暫停狀態
        self.stop_flag = False    # 強制結束(原本的緊急停止，保留備用)
        self.time_remaining = 0   # 剩餘秒數 (顯示用)

        if GPIO_AVAILABLE:
            GPIO.setmode(GPIO.BCM)
            GPIO.setup(self.PIN_PUMP_SODA, GPIO.OUT)
            GPIO.setup(self.PIN_PUMP_ALCOHOL, GPIO.OUT)
            self._turn_off_all_pumps()

        self.reset_game_hard()

    def _turn_off_all_pumps(self):
        if GPIO_AVAILABLE:
            GPIO.output(self.PIN_PUMP_SODA, GPIO.HIGH)
            GPIO.output(self.PIN_PUMP_ALCOHOL, GPIO.HIGH)

    def _update_action_id(self):
        self.game_data['action_id'] = str(uuid.uuid4())

    def toggle_pause(self):
        """切換 暫停/繼續 狀態"""
        self.is_paused = not self.is_paused
        # 如果按下暫停，立刻關閉馬達以策安全
        if self.is_paused:
            self._turn_off_all_pumps()
            self.game_data['message'] = "⚠️ 調酒已暫停 (PAUSED)"
        else:
            self.game_data['message'] = "調酒繼續..."
        
        self._update_action_id()
        return self.is_paused

    def reset_game_hard(self):
        self._turn_off_all_pumps()
        self.state = "LOBBY"
        self.players = []
        self.current_player_index = 0
        self.game_data = {'action_id': 'init'}
        self.round_count = 1
        self.dispensed_ids = []
        self.is_paused = False
        self.time_remaining = 0

    def restart_game_soft(self):
        self._turn_off_all_pumps()
        self.state = "LOBBY"
        self.round_count += 1
        self.dispensed_ids = []
        self.current_player_index = 0
        self.game_data = {'action_id': 'restart'}
        self.is_paused = False
        self.time_remaining = 0
        for p in self.players:
            p['score'] = 0
            p['status'] = 'ready'

    # ... (add_player, submit_name, start_game 保持不變) ...
    def add_player(self, uid, team):
        for p in self.players:
            if p['id'] == uid: return False
        if len(self.players) < 4:
            self.players.append({
                'id': uid, 'team': team, 'name': '', 'score': 0,
                'alcohol_acc': 0, 'current_alcohol': 0, 'current_soda': 0,
                'status': 'waiting_for_name'
            })
            self.state = "WAITING_FOR_NAME"
            self.current_player_index = len(self.players) - 1
            self._update_action_id()
            return True
        return False

    def submit_name(self, name):
        if self.state == "WAITING_FOR_NAME":
            self.players[self.current_player_index]['name'] = name
            self.state = "LOBBY"
            self._update_action_id()
            return True
        return False

    def start_game(self):
        if len(self.players) >= 2:
            self.current_player_index = 0
            self.init_dice_game()
            return True
        return False

    # === Game 1: Dice (數值減半) ===
    def init_dice_game(self):
        self.state = "GAME_1_DICE"
        self.game_data = {'dice1': '?', 'dice2': '?', 'message': '請擲骰子'}
        self._update_action_id()

    def roll_dice(self):
        d1 = random.randint(1, 6)
        d2 = random.randint(1, 6)
        total = d1 + d2
        
        # [Adjusted] 數值除以 2
        # 7: -10 (原-20)
        # 8: +10 (原+20)
        # 9: -25 (原-50)
        # Other: +5 (原+10)
        if total == 7: change = -10
        elif total == 8: change = 10
        elif total == 9: change = -25
        else: change = 5
            
        self.players[self.current_player_index]['score'] += change
        self.game_data.update({'dice1': d1, 'dice2': d2, 'score_change': change, 'message': f"{total}點! 分數 {change:+}"})
        self._update_action_id()
        return self.game_data

    def next_player_dice(self):
        self.current_player_index += 1
        if self.current_player_index >= len(self.players):
            self.current_player_index = 0
            self.init_vocab_game()
        else:
            self.init_dice_game()

    # === Game 2: Vocab (數值減半) ===
    def init_vocab_game(self):
        self.state = "VOCAB_SELECT_TOPIC"
        self.game_data = {'dealer_index': self.current_player_index, 'topic': '', 'answers': {}}
        self._update_action_id()

    def vocab_select_topic(self, topic):
        self.game_data['topic'] = topic
        self.state = "VOCAB_THINKING"
        self._update_action_id()
        return True

    def vocab_submit_answer(self, pid, ans):
        self.game_data['answers'][pid] = ans
        self._update_action_id()
        return True

    def vocab_finish_thinking(self):
        self.state = "VOCAB_JUDGING"
        self._update_action_id()
        return True

    def vocab_judge(self, results):
        for pid, passed in results.items():
            for p in self.players:
                if p['id'] == pid:
                    # [Adjusted] 通過+15, 駁回-10
                    change = 15 if passed else -10
                    p['score'] += change
        
        self.current_player_index += 1
        if self.current_player_index >= len(self.players):
            self.current_player_index = 0
            self.init_poker_game()
        else:
            self.init_vocab_game()
        return True

    # === Game 3: Poker (數值減半) ===
    def init_poker_game(self):
        self.state = "POKER_BET_CHOICE"
        c1 = random.randint(1, 13)
        c2 = random.randint(1, 13)
        while c1 == c2: c2 = random.randint(1, 13)
        if c1 > c2: c1, c2 = c2, c1
        self.game_data = {'card1': c1, 'card2': c2, 'card3': '?', 'status': 'betting'}
        self._update_action_id()

    def poker_bet(self, is_betting):
        if not is_betting:
            # [Adjusted] 放棄 -5 (原-10)
            self.players[self.current_player_index]['score'] -= 5
            self.game_data['status'] = 'passed'
            self.game_data['card3'] = 'PASS'
            self.state = "GAME_3_POKER" 
        else:
            self.game_data['status'] = 'dealing'
            self.state = "GAME_3_POKER"
        self._update_action_id()
        return True

    def draw_third_card(self):
        c3 = random.randint(1, 13)
        c1 = self.game_data['card1']
        c2 = self.game_data['card2']
        # [Adjusted] 進球+10, 撞柱-25, 界外-10
        if c3 > c1 and c3 < c2: change = 10
        elif c3 == c1 or c3 == c2: change = -25
        else: change = -10
            
        self.players[self.current_player_index]['score'] += change
        self.game_data.update({'card3': c3, 'score_change': change, 'status': 'revealed'})
        self._update_action_id()
        return self.game_data

    def next_player_poker(self):
        self.current_player_index += 1
        if self.current_player_index >= len(self.players):
            self.calculate_final_mix()
            self.state = "FINISHED"
            self._update_action_id()
            return True
        else:
            self.init_poker_game()
            return False

    # === End & Dispense (數值/2) ===
    def calculate_final_mix(self):
        for p in self.players:
            # 酒精公式: 50 - 分數 (Min 0, Max 50)
            alc = 50 - p['score']
            alc = max(0, min(50, alc))
            # 氣泡水: 225 - 酒精
            soda = 225 - alc
            
            p['current_alcohol'] = alc
            p['current_soda'] = soda
            p['alcohol_acc'] += alc

    def start_dispensing_phase(self):
        self.state = "DISPENSING_DRINKS"
        self.game_data['message'] = "請依序放入杯子..."
        self.is_paused = False
        self._update_action_id()

    def scan_cup_for_dispensing(self, uid):
        target_player = None
        for p in self.players:
            if p['id'] == uid:
                target_player = p; break
        if not target_player or uid in self.dispensed_ids: return False

        self.dispensed_ids.append(uid)
        self.game_data['message'] = f"正在為 {target_player['name']} 調酒中..."
        self.is_paused = False # 每次新調酒都重置暫停
        self._update_action_id()
        t = threading.Thread(target=self._run_pumps, args=(target_player,))
        t.start()
        return True

    def _pump_timer_loop(self, pin, duration_sec):
        """帶有暫停功能的倒數計時幫浦控制"""
        remaining = duration_sec
        step = 0.1 # 每 0.1 秒檢查一次

        while remaining > 0:
            # 更新顯示用的剩餘時間 (加總邏輯在 run_pumps 處理，這裡只做單一幫浦)
            # 這裡我們不直接更新 self.time_remaining，而是在外層迴圈做
            
            if self.is_paused:
                # 若暫停：關閉馬達，不扣時間，只空轉等待
                if GPIO_AVAILABLE: GPIO.output(pin, GPIO.HIGH)
                time.sleep(step)
                continue

            # 若執行中：開啟馬達，扣時間
            if GPIO_AVAILABLE: GPIO.output(pin, GPIO.LOW)
            time.sleep(step)
            remaining -= step
            
            # 回傳剩餘時間給外層用來顯示
            yield remaining

        # 時間到，確保關閉
        if GPIO_AVAILABLE: GPIO.output(pin, GPIO.HIGH)

    def _run_pumps(self, player):
        SEC_PER_ML = 1.4
        soda_time = player['current_soda'] * SEC_PER_ML
        alc_time = player['current_alcohol'] * SEC_PER_ML
        
        total_time = soda_time + alc_time
        print(f"Start: {player['name']} | Total Time: {total_time:.1f}s")

        # 1. 氣泡飲階段
        if soda_time > 0:
            # 使用生成器來跑迴圈
            for rem_soda in self._pump_timer_loop(self.PIN_PUMP_SODA, soda_time):
                # 更新全域剩餘時間 = 剩餘汽水時間 + 待會要跑的酒精時間
                self.time_remaining = rem_soda + alc_time
        
        # 間隔 (如果沒暫停的話)
        if not self.is_paused:
            time.sleep(1)

        # 2. 酒精階段
        if alc_time > 0:
            for rem_alc in self._pump_timer_loop(self.PIN_PUMP_ALCOHOL, alc_time):
                self.time_remaining = rem_alc
        
        self.time_remaining = 0
        self._turn_off_all_pumps()

        if len(self.dispensed_ids) >= len(self.players):
            self.game_data['message'] = "所有調酒完成！"
            self.state = "DISPENSING_FINISHED"
        else:
            self.game_data['message'] = f"{player['name']} 完成! 下一位"
        self._update_action_id()

    def get_state(self):
        return {
            "state": self.state,
            "players": self.players,
            "current_player_index": self.current_player_index,
            "game_data": self.game_data,
            "time_remaining": int(self.time_remaining), # 傳回整數秒
            "is_paused": self.is_paused
        }
