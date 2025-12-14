import RPi.GPIO as GPIO
from mfrc522 import SimpleMFRC522
import requests
import time

reader = SimpleMFRC522()
SERVER_URL = "http://127.0.0.1:5000/rfid_login" # 確保 port 是 5000

print("===================================")
print("   RFID Daemon Running... (Ctrl+C to stop)")
print("===================================")

try:
    last_uid = None
    last_time = 0

    while True:
        # 讀取卡片
        id, text = reader.read_no_block() # 使用非阻塞讀取
        
        if id:
            current_time = time.time()
            # 簡單的防手抖 (3秒內不重複送同一張卡)
            if id != last_uid or (current_time - last_time) > 3:
                uid_str = str(id)
                print(f"偵測到卡片 UID: {uid_str}")
                
                try:
                    res = requests.post(SERVER_URL, json={"uid": uid_str})
                    print(f"Server 回應: {res.json()}")
                except Exception as e:
                    print(f"Server 連線失敗: {e}")

                last_uid = id
                last_time = current_time
            
        time.sleep(0.5)

except KeyboardInterrupt:
    GPIO.cleanup()
