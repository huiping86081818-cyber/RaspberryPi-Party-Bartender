let lastActionId = "";
let players = [];
let currentPlayerIndex = 0;
let tempJudgeResults = {};

// [New] 取得我的身分 (從 LocalStorage)
function getMyTeam() {
    return localStorage.getItem('myTeam');
}

// [New] 設定我的身分
function setMyTeam(team) {
    localStorage.setItem('myTeam', team);
    document.getElementById('my-team-display').innerText = team;
    document.getElementById('identity-badge').style.display = 'block';
}

// [New] 關閉登入視窗
function closeLoginModal() {
    document.getElementById('name-input-modal').style.display = 'none';
}

window.updateJudge = function(pid, val) {
    tempJudgeResults[pid] = val;
    const radioTrue = document.querySelector(`input[name="j-${pid}"][value="true"]`);
    const radioFalse = document.querySelector(`input[name="j-${pid}"][value="false"]`);
    if(val === true && radioTrue) radioTrue.checked = true;
    if(val === false && radioFalse) radioFalse.checked = true;
}

window.enableAudio = function() {
    const bgm = document.getElementById('audio-bgm');
    bgm.volume = 0.5;
    bgm.play().then(() => {
        document.getElementById('music-starter').style.display = 'none';
        console.log("BGM Started");
    }).catch(e => {
        console.error("Audio Error:", e);
        alert("無法播放聲音，請確認檔案是否存在或瀏覽器設定。");
    });
}

function updateUI(data) {
    if (!data) return;

    const currentActionId = data.game_data.action_id || "init";
    const currentState = data.state;
    players = data.players;
    currentPlayerIndex = data.current_player_index;
    
    // 取得當前玩家物件與我的身分
    const currentPlayer = players[currentPlayerIndex];
    const myTeam = getMyTeam();
    // 判斷：現在是不是輪到我？
    const isMyTurn = (currentPlayer && currentPlayer.team === myTeam);

    // 暴力刷新邏輯
    if (currentActionId !== lastActionId) {
        console.log(`Action Update: ${lastActionId} -> ${currentActionId}`);
        if (currentState.startsWith('VOCAB')) {
            document.getElementById('vocab-judge-list').innerHTML = '';
            if (currentState !== 'VOCAB_JUDGING') tempJudgeResults = {};
        }
        lastActionId = currentActionId;
    }

    // 1. 更新玩家列表
    const pContainer = document.getElementById('player-container');
    pContainer.innerHTML = '';
    players.forEach((p, idx) => {
        const div = document.createElement('div');
        let classes = `player-card ${p.team}`;
        if (idx === currentPlayerIndex && !currentState.includes("LOBBY") && !currentState.includes("FINISHED")) {
            classes += ' active';
        }
        div.className = classes;
        let html = `<img src="/static/images/role_${p.team}.png" class="player-avatar" onerror="this.src='https://placehold.co/100x100?text=${p.team}'">`;
        if (p.alcohol_acc > 0) html += `<div class="alcohol-badge">${p.alcohol_acc}</div>`;
        html += `<div>${p.name || '...'}</div><div style="font-size:0.8em">Score: ${p.score}</div>`;
        div.innerHTML = html;
        pContainer.appendChild(div);
    });

    // 顯示身分Badge (如果有的話)
    if (myTeam) {
        document.getElementById('my-team-display').innerText = myTeam;
        document.getElementById('identity-badge').style.display = 'block';
    }

    document.querySelectorAll('.game-section').forEach(el => el.classList.remove('active'));

    // --- 狀態機 UI ---

    if (currentState === 'LOBBY') {
        document.getElementById('lobby-section').classList.add('active');
        document.getElementById('status-text').innerText = "等待玩家加入...";
        
        // 開始按鈕：如果我是任何一個已登入的玩家，我都能看到開始按鈕
        const amILoggedIn = players.some(p => p.team === myTeam);
        document.getElementById('start-btn-container').style.display = (players.length >= 2 && amILoggedIn) ? 'block' : 'none';

    } else if (currentState === 'WAITING_FOR_NAME') {
        document.getElementById('lobby-section').classList.add('active');
        // [Logic] 只有當前需要輸入名字的隊伍，且我還沒確認身分時，才跳窗
        // 我們檢查：現在系統在等哪個 Team？
        const pendingPlayer = players[currentPlayerIndex];
        
        // 只有當「後端在等這個隊伍」且「我尚未綁定身分」或「我就是這個身分」時顯示
        // 為了簡單，我們顯示彈窗給所有人，但有「這不是我」按鈕
        
        const modal = document.getElementById('name-input-modal');
        if (modal.style.display !== 'none') {
            // 視窗開著，不動作，等待使用者操作
        } else {
            // 如果我已經登入過了，就不跳窗
            // 如果我沒登入，就跳窗問是不是我
            if (!myTeam) {
                document.getElementById('modal-title').innerText = `偵測到 ${pendingPlayer.team} 隊！`;
                document.getElementById('modal-desc').innerText = `你是 ${pendingPlayer.team} 隊嗎？`;
                modal.style.display = 'flex';
                // 暫存這個 pending team 供 submitName 使用
                modal.dataset.pendingTeam = pendingPlayer.team;
            }
        }

    } else if (currentState === 'GAME_1_DICE') {
        document.getElementById('dice-section').classList.add('active');
        document.getElementById('status-text').innerText = 'Game 1: 七加八減酒';
        document.getElementById('dice-player').innerText = getCurrentPlayerName();

        const ruleText = '7(-10), 8(+10), 9(-25), 其他(+5)';
        
        // 渲染畫面 (所有人都要看得到)
        if (data.game_data.dice1 !== '?') {
            renderDice('dice-1', data.game_data.dice1);
            renderDice('dice-2', data.game_data.dice2);
            document.getElementById('dice-msg').innerText = data.game_data.message;
            // 只要有結果，所有人隱藏擲骰按鈕，顯示下一位(如果是我)
            document.getElementById('dice-controls').style.display = 'none';
            document.getElementById('dice-wait-msg').style.display = 'none';
            // 只有當前玩家能按 Next
            document.getElementById('btn-dice-next').style.display = isMyTurn ? 'inline-block' : 'none';
        } else {
            // 準備擲骰
            document.getElementById('dice-1').innerText = '?';
            document.getElementById('dice-2').innerText = '?';
            document.getElementById('dice-msg').innerText = ruleText;
            document.getElementById('btn-dice-next').style.display = 'none';
            
            // [Permission] 只有輪到的人看得到按鈕
            if (isMyTurn) {
                document.getElementById('dice-controls').style.display = 'block';
                document.getElementById('dice-wait-msg').style.display = 'none';
            } else {
                document.getElementById('dice-controls').style.display = 'none';
                document.getElementById('dice-wait-msg').style.display = 'block';
                document.getElementById('dice-wait-msg').innerText = `等待 ${getCurrentPlayerName()} 擲骰子...`;
            }
        }

    } else if (currentState.startsWith('VOCAB')) {
        document.getElementById('vocab-section').classList.add('active');
        document.getElementById('status-text').innerText = 'Game 2: 詞善團體';
        document.getElementById('vocab-player').innerText = getCurrentPlayerName();
        
        document.getElementById('vocab-topic-ui').style.display = 'none';
        document.getElementById('vocab-thinking-ui').style.display = 'none';
        document.getElementById('vocab-judging-ui').style.display = 'none';

        if (currentState === 'VOCAB_SELECT_TOPIC') {
            document.getElementById('vocab-topic-ui').style.display = 'block';
            stopVocabTimer();
            
            // [Permission] 只有莊家能出題
            if (isMyTurn) {
                document.getElementById('vocab-dealer-controls').style.display = 'block';
                document.getElementById('vocab-dealer-wait').style.display = 'none';
            } else {
                document.getElementById('vocab-dealer-controls').style.display = 'none';
                document.getElementById('vocab-dealer-wait').style.display = 'block';
                document.getElementById('vocab-dealer-wait').innerText = `等待莊家 (${getCurrentPlayerName()}) 出題...`;
            }

        } else if (currentState === 'VOCAB_THINKING') {
            document.getElementById('vocab-thinking-ui').style.display = 'block';
            document.getElementById('vocab-topic-display').innerText = data.game_data.topic;
            // 傳入 isMyTurn (莊家) 與 myTeam 讓 render 判斷
            renderVocabInputs(data.game_data.answers, isMyTurn, myTeam);
            
            if (!vocabTimerInterval && vocabTimeLeft > 0) startVocabTimer();
            
            // 只有莊家能按強制結束
            document.getElementById('btn-vocab-finish').style.display = isMyTurn ? 'inline-block' : 'none';

        } else if (currentState === 'VOCAB_JUDGING') {
            document.getElementById('vocab-judging-ui').style.display = 'block';
            renderJudgeList(data.game_data.answers, isMyTurn); // 傳入是否為莊家
            stopVocabTimer();
            
            // 只有莊家能送出
            document.getElementById('btn-vocab-judge').style.display = isMyTurn ? 'inline-block' : 'none';
            document.getElementById('vocab-judge-wait').style.display = isMyTurn ? 'none' : 'block';
        }

    } else if (currentState.startsWith('GAME_3_POKER') || currentState === 'POKER_BET_CHOICE') {
        document.getElementById('poker-section').classList.add('active');
        document.getElementById('status-text').innerText = 'Game 3: 射龍門';
        document.getElementById('poker-player').innerText = getCurrentPlayerName();

        document.getElementById('card-1').innerHTML = renderCard(data.game_data.card1);
        document.getElementById('card-2').innerHTML = renderCard(data.game_data.card2);
        const c3 = data.game_data.card3;
        document.getElementById('card-3').innerHTML = renderCard((c3==='?'||c3===0)?'?':c3);

        document.getElementById('poker-controls').style.display = 'none';
        document.getElementById('btn-draw').style.display = 'none';
        document.getElementById('btn-poker-next').style.display = 'none';
        document.getElementById('poker-wait-msg').style.display = 'none';

        if (currentState === 'POKER_BET_CHOICE' || data.game_data.status === 'betting') {
            document.getElementById('poker-msg').innerText = "請選擇：下注(Draw) 或 不抽(Pass)";
            if (isMyTurn) {
                document.getElementById('poker-controls').style.display = 'block';
            } else {
                document.getElementById('poker-wait-msg').style.display = 'block';
                document.getElementById('poker-wait-msg').innerText = `等待 ${getCurrentPlayerName()} 下注...`;
            }

        } else if (data.game_data.status === 'dealing') {
            document.getElementById('poker-msg').innerText = "已下注! 請抽牌";
            if (isMyTurn) {
                document.getElementById('btn-draw').style.display = 'inline-block';
            } else {
                document.getElementById('poker-wait-msg').style.display = 'block';
                document.getElementById('poker-wait-msg').innerText = `等待 ${getCurrentPlayerName()} 抽牌...`;
            }

        } else {
            const s = data.game_data.score_change;
            let txt = (data.game_data.status === 'passed') ? "放棄 (-5)" : 
                      (s==10?"射門成功 (+10)": (s==-25?"撞柱! (-25)":"進門失敗 (-10)"));
            document.getElementById('poker-msg').innerText = txt;
            
            if (isMyTurn) {
                document.getElementById('btn-poker-next').style.display = 'inline-block';
            }
        }

    } else if (currentState === 'FINISHED') {
        document.getElementById('finished-section').classList.add('active');
        document.getElementById('status-text').innerText = '遊戲結束';
        renderResults();

    } else if (currentState.startsWith('DISPENSING')) {
        document.getElementById('dispensing-section').classList.add('active');
        document.getElementById('status-text').innerText = '調酒模式';
        document.getElementById('dispense-msg').innerText = data.game_data.message;
        
        const timeVal = data.time_remaining || 0;
        document.getElementById('dispense-timer').innerText = timeVal;
        
        const btnPause = document.getElementById('btn-pause');
        if (data.is_paused) {
            btnPause.innerText = "▶ 繼續 (RESUME)";
            btnPause.classList.remove('yellow');
            btnPause.classList.add('green');
        } else {
            btnPause.innerText = "⏸ 暫停 (PAUSE)";
            btnPause.classList.remove('green');
            btnPause.classList.add('yellow');
        }

        if (currentState === 'DISPENSING_FINISHED') {
            document.getElementById('end-options').style.display = 'block';
            btnPause.style.display = 'none';
            document.getElementById('timer-box').style.display = 'none';
        } else {
            document.getElementById('end-options').style.display = 'none';
            btnPause.style.display = 'inline-block';
            document.getElementById('timer-box').style.display = 'block';
        }
    }
}

// Helpers
function getCurrentPlayerName() { return (players[currentPlayerIndex]) ? players[currentPlayerIndex].name : "..."; }

// Render Functions
function renderDice(id, val) {
    const el = document.getElementById(id); el.innerHTML = ''; 
    const face = document.createElement('div'); face.className = 'dice-face';
    const dots = [];
    if(val==1) dots.push(5); if(val==2) dots.push(1,9); if(val==3) dots.push(1,5,9);
    if(val==4) dots.push(1,3,7,9); if(val==5) dots.push(1,3,5,7,9); if(val==6) dots.push(1,3,4,6,7,9);
    for(let i=1;i<=9;i++){ const d = document.createElement('div'); if(dots.includes(i)) d.className='dot'; face.appendChild(d); }
    el.appendChild(face);
}
function renderCard(val) {
    if(val==='?'||val===0) return '<div class="card-center">?</div>';
    if(val==='PASS') return '<div class="card-center" style="font-size:1.5rem">PASS</div>';
    let d = val; if(val==1)d='A'; else if(val==11)d='J'; else if(val==12)d='Q'; else if(val==13)d='K';
    const s = ['♠','♥','♦','♣'][Math.floor(Math.random()*4)];
    const c = (s=='♥'||s=='♦')?'red-suit':'black-suit';
    return `<div class="card poker ${c}" style="width:100%;height:100%;display:flex;flex-direction:column;justify-content:space-between;">
        <div class="card-corner top-left"><div>${d}</div><div>${s}</div></div><div class="card-center">${s}</div><div class="card-corner bottom-right"><div>${d}</div><div>${s}</div></div></div>`;
}

// [Updated] 根據身分渲染輸入框
function renderVocabInputs(answers, isDealer, myTeam) {
    const div = document.getElementById('vocab-inputs');
    if (div.children.length > 0 && lastActionId === div.dataset.actionId) return;
    div.dataset.actionId = lastActionId;
    div.innerHTML = '';
    
    players.forEach((p, idx) => {
        const pIsDealer = (idx === currentPlayerIndex);
        let html = "";

        if (pIsDealer) {
            html = `<span style="color:blue;font-weight:bold;">(莊家)</span>`;
        } else {
            const hasAns = answers[p.id];
            if (hasAns) {
                html = `<span style="color:green;font-weight:bold;">已回答: ${hasAns}</span>`; // 大家都看得到答案
            } else {
                // 如果我是這位閒家，我要看到輸入框；如果不是，我看到等待中
                if (myTeam === p.team) {
                    html = `<input type="text" id="ans-${p.id}"> <button onclick="vocabSubmitAnswer('${p.id}')">送出</button>`;
                } else {
                    html = `<span style="color:#666;">作答中...</span>`;
                }
            }
        }
        div.innerHTML += `<div style="margin:5px;"><label>${p.name}: </label> ${html}</div>`;
    });
}

// [Updated] 根據身分渲染評分列表
function renderJudgeList(answers, isDealer) {
    const div = document.getElementById('vocab-judge-list');
    div.innerHTML = '';
    players.forEach((p, idx) => {
        if (idx === currentPlayerIndex) return;
        const ans = answers[p.id] || "(未回答)";
        
        let controlHtml = "";
        const passed = tempJudgeResults[p.id] === true;
        const rejected = tempJudgeResults[p.id] === false;

        if (isDealer) {
            // 莊家看到按鈕
            controlHtml = `
            <div style="margin-top:5px;">
            <label><input type="radio" name="j-${p.id}" ${passed?'checked':''} onclick="updateJudge('${p.id}',true)"> 通過 (+15)</label>
            <label><input type="radio" name="j-${p.id}" ${rejected?'checked':''} onclick="updateJudge('${p.id}',false)"> 駁回 (-10)</label>
            </div>`;
        } else {
            // 閒家看到即時結果 (Observer)
            let status = "等待評分...";
            if (passed) status = "⭕ 通過";
            if (rejected) status = "❌ 駁回";
            controlHtml = `<div style="margin-top:5px; font-weight:bold; color:var(--lego-blue);">${status}</div>`;
        }

        div.innerHTML += `<div style="margin:10px;border:1px solid black;padding:5px;text-align:left;">
            <strong>${p.name}</strong>: ${ans}<br>
            ${controlHtml}
            </div>`;
    });
}

function renderResults() {
    const tbody = document.getElementById('result-body'); tbody.innerHTML = '';
    players.forEach(p => tbody.innerHTML += `<tr><td>${p.name}</td><td>${p.score}</td>
        <td style="color:red;font-weight:bold;">${p.current_alcohol}</td><td>${p.current_soda}</td><td>${p.alcohol_acc}</td></tr>`);
}

// Timer
let vocabTimerInterval, vocabTimeLeft=30;
function startVocabTimer() {
    if(vocabTimerInterval) clearInterval(vocabTimerInterval);
    vocabTimeLeft=30; updateTimerDisplay();
    vocabTimerInterval = setInterval(()=>{
        vocabTimeLeft--; updateTimerDisplay();
        if(vocabTimeLeft<=0) { clearInterval(vocabTimerInterval); vocabFinishThinking(); }
    },1000);
}
function updateTimerDisplay(){ const el=document.getElementById('vocab-timer'); if(el) el.innerText=`剩餘: ${vocabTimeLeft}s`; }
function stopVocabTimer(){ if(vocabTimerInterval) clearInterval(vocabTimerInterval); const el=document.getElementById('vocab-timer'); if(el) el.innerText=""; }

// Actions
async function post(url, body={}) { await fetch(url, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)}); }
async function testLogin(c) { await fetch(`/test_login/${c}`); }

async function submitName() { 
    const n = document.getElementById('player-name-input').value; 
    // [Important] 綁定身分
    const modal = document.getElementById('name-input-modal');
    const myTeam = modal.dataset.pendingTeam;
    setMyTeam(myTeam); // 寫入 LocalStorage

    await post('/submit_name',{name:n}); 
    closeLoginModal();
}

async function startGame() { await post('/start_game'); }
async function rollDice() { await post('/submit_action',{action:'roll'}); }
async function nextTurn(g) { await post('/submit_action',{action:'next'}); }
async function vocabSetTopic() { await post('/submit_action',{action:'select_topic',topic:document.getElementById('vocab-topic').value}); }
async function vocabSubmitAnswer(pid) { await post('/submit_action',{action:'submit_answer',player_id:pid,answer:document.getElementById(`ans-${pid}`).value}); }
async function vocabFinishThinking() { await post('/submit_action',{action:'finish_thinking'}); }
async function vocabSubmitJudge() { await post('/submit_action',{action:'judge',results:tempJudgeResults}); }
async function pokerBet(flag) { await post('/submit_action',{action:'bet',bet:flag}); }
async function drawCard() { await post('/submit_action',{action:'draw'}); }
async function startDispensing() { await post('/start_dispensing'); }
async function resetGame(type) { await post('/reset_game',{type:type}); }

async function togglePause() {
    const res = await fetch('/toggle_pause', {method: 'POST'});
    const data = await res.json();
    console.log("Paused:", data.is_paused);
}

setInterval(async()=>{ try{const res=await fetch('/game_update');updateUI(await res.json());}catch(e){} }, 1000);