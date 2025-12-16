# Raspberry Pi對 調酒師

這是一個結合 IoT 物聯網、Web 前端互動的智慧調酒系統。玩家透過 RFID 綁定身分，在手機上進行多人互動遊戲（骰子、造詞、射龍門），系統會根據遊戲分數自動計算「酒精濃度」，分數越低酒精越多，最後驅動蠕動幫浦調製出專屬飲品。

# youtube 影片連結

https://www.youtube.com/watch?v=jJUcVitObDs

## 特色 (Features)

  * **多人互動遊戲**：支援 4 人同時連線，包含《七加八減酒》、《詞善團體》、《射龍門》三款派對遊戲。
  * **響應式網頁 (RWD)**：採用 **樂高 (LEGO)** 風格設計，手機/平板/電腦皆可操作。
  * **RFID 身分識別**：刷卡感應RFID自動登入，系統自動綁定紅/藍/黃/綠四個隊伍。
  * **專屬操作權限**：前端具有身分驗證機制，只有輪到的玩家手機會顯示操作按鈕，防止誤觸。
  * **自動調酒系統**：根據遊戲積分動態計算 [氣泡水 : 酒精] 比例，透過繼電器控制蠕動幫浦精準出水。
  * **數據持久化**：使用 SQLite 資料庫紀錄每一局的詳細分數與酒精攝取量。
  * **安全機制**：具備軟體緊急暫停功能。

## 硬體架構 (Hardware)

  * **實際接線圖**
<img width="1104" height="779" alt="image" src="https://github.com/user-attachments/assets/a8ba1f80-bc75-444c-bb04-da3b7189383c" />

  * **1-控制器**：Raspberry Pi 4 Model B
  * **2-感測器**：RFID-RC522 (SPI 介面)
  * **3-驅動模組**：4路繼電器模組 (4-Channel Relay, 低電位觸發)
  * **4-執行元件**：12V 水泵 x2 (Pump 1: 氣泡水, Pump 2: 酒精)
  * **5-電源**：
      * 5-1 Raspberry Pi: 5V (USB-C)
      * 5-2 Pumps: 12V (110V轉12V 交換式電源供應＋電線)
  * **6-麵包版**
  * **7-杜邦線**
  * **8-食用級水管**
    
  * **成品圖(以樂高建立整體結構)**
<img width="690" height="860" alt="image" src="https://github.com/user-attachments/assets/0ca109c0-7f9f-4c9c-ba78-a1f772b6b348" />

## 軟體技術 (Tech Stack)

  * **後端**: Python 3, Flask (Web Server)
  * **前端**: HTML5, CSS3 (LEGO Style), Vanilla JavaScript (AJAX Polling)
  * **資料庫**: SQLite
  * **硬體控制**: RPi.GPIO, spidev, mfrc522
  * **聯網**: Ngrok 

## 前端遊戲模擬登入畫面

<img width="1419" height="783" alt="image" src="https://github.com/user-attachments/assets/b94ebc30-3fcd-4b6d-a82d-de2f243b15e2" />


## 安裝與執行 (Installation & Usage)

### 1\. 環境設定

確保 Raspberry Pi 已啟用 SPI 介面並安裝必要套件：

```bash
sudo raspi-config  # 開啟 Interfacing Options -> SPI
sudo apt update
sudo apt install python3-pip git -y
pip3 install flask RPi.GPIO spidev mfrc522
```

### 2\. 下載專案

```bash
git clone https://github.com/huiping86081818-cyber/RaspberryPi-Party-Bartender.git
cd RaspberryPi-Party-Bartender
```

### 3\. 啟動系統

本系統需要開啟三個終端機視窗同時執行：

**視窗 A: 啟動網頁伺服器與遊戲邏輯**

```bash
python3 app.py
```

**視窗 B: 啟動 RFID 監聽程式**

```bash
python3 rfid_daemon.py
```
**視窗 C: 啟動 Ngrok 隧道 (對外通道)**

```bash
ngrok http 5000
```

### 4\. 開始使用

1.  打開瀏覽器輸入 ` https://sanidinic-ungrappling-nathaniel.ngrok-free.dev` 。
2.  點擊右下角 **「開啟聲音」**。
3.  將 RFID 卡片/杯子放置於讀卡機上登入。
4.  依照網頁指示進行遊戲。

## 📂 檔案結構 (File Structure)

```text
RaspberryPi-Smart-Bartender/
├── app.py                # Flask 後端主程式 (API & 路由)
├── game_manager.py       # 遊戲核心邏輯、狀態機與 GPIO 控制
├── rfid_daemon.py        # RFID 背景監聽服務
├── game_history.db       # SQLite 資料庫 (自動生成)
├── static/               # 前端靜態資源
│   ├── css/
│   │   └── lego_style.css  # 樂高風格樣式表
│   ├── js/
│   │   └── game.js         # 前端互動邏輯 (Polling, UI更新)
│   ├── images/             # 圖片素材 (role_*.png, dice, poker)
│   └── sounds/             # 音效素材 (bgm.mp3, scan.mp3)
└── templates/
    └── game_stage.html     # 主要遊戲頁面
```

##  遊戲規則 (Game Rules)

1.  **七加八減酒 (Dice)**：
      * 總和 7：扣 10 分 (更多酒精)
      * 總和 8：加 10 分 (減少酒精)
      * 總和 9：扣 25 分 (大懲罰)
      * 其他：加 5 分
2.  **詞善團體 (Vocab)**：
      * 莊家出題 (注音)，閒家答題。
      * 莊家評判通過：+15 分
      * 莊家評判駁回：-10 分
3.  **射龍門 (Poker)**：
      * 撞柱：扣 25 分
      * 進球：加 10 分
      * 界外：扣 10 分
      * 放棄 (Pass)：扣 5 分

**調酒公式**：

  * 酒精量 (ml) = `50 - 分數` (Max: 50, Min: 0)
  * 氣泡水量 (ml) = `225 - 酒精量`

## 注意事項 (Notes)

  * **電源安全**：請確保馬達使用的是獨立 12V 電源，勿直接從 Raspberry Pi 取電。
  * **緊急停止**：如遇液體溢出或硬體異常，請點擊網頁上的 **「緊急停止」** 按鈕或直接拔除馬達電源。
  * **音效播放**：受瀏覽器政策限制，進入網頁後必須先與頁面互動 (點擊開啟聲音) 才能自動播放背景音樂。

## 參考資料

IoT-bartender：https://github.com/chung-coder/Iot-bartender
