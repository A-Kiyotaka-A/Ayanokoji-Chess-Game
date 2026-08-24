let board = null;
let game = new Chess();
let playerColor = 'white';
let showHints = true;
let selectedSquare = null;

// متغيرات البوت الهجين
let useStockfish = true;
let stockfish = null;

// --- نظام الصوت ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playSound(type) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    if (type === 'move') {
        osc.frequency.setValueAtTime(400, audioCtx.currentTime);
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        osc.start(); osc.stop(audioCtx.currentTime + 0.1);
    } else if (type === 'capture') {
        osc.frequency.setValueAtTime(250, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(120, audioCtx.currentTime + 0.2);
        gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
        osc.start(); osc.stop(audioCtx.currentTime + 0.2);
    } else if (type === 'gameover') {
        osc.frequency.setValueAtTime(600, audioCtx.currentTime);
        osc.frequency.setValueAtTime(400, audioCtx.currentTime + 0.15);
        gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
        osc.start(); osc.stop(audioCtx.currentTime + 0.4);
    }
}

// --- تهيئة البوت الهجين (Stockfish 3000+ أو Alpha-Beta 1600+) ---
function initBot() {
    try {
        // المحاولة الأولى: تشغيل Stockfish (سيعمل بنجاح على GitHub Pages)
        stockfish = new Worker('https://cdnjs.cloudflare.com/ajax/libs/stockfish.js/10.0.0/stockfish.js');
        stockfish.onmessage = function(event) {
            if (event.data.startsWith('bestmove')) {
                const bestMove = event.data.split(' ')[1];
                if (bestMove && bestMove !== '(none)') {
                    executeAiMove(bestMove);
                }
            }
        };
        console.log("✅ تم تفعيل محرك Stockfish الأصلي (مستوى 3000+ ELO).");
    } catch (e) {
        // المحاولة الثانية: إذا فشل بسبب قيود المتصفح المحلي، نستخدم البديل القوي
        console.warn("⚠️ فشل تحميل Stockfish محلياً. جاري تفعيل البوت البديل القوي (مستوى 1600+).");
        useStockfish = false;
    }
}

window.addEventListener('DOMContentLoaded', () => {
    document.getElementById('fullscreenToggle').addEventListener('click', () => {
        if (!document.fullscreenElement) document.documentElement.requestFullscreen();
        else if (document.exitFullscreen) document.exitFullscreen();
    });

    document.getElementById('hintsToggle').addEventListener('click', function() {
        showHints = !showHints;
        this.classList.toggle('active-hint', showHints);
        if (!showHints) {
            selectedSquare = null;
            removeHighlights();
        }
    });

    $(document).on('click', '#board .square-55d63', function() {
        if (!showHints || game.game_over()) return;
        
        const classes = $(this).attr('class').split(/\s+/);
        const square = classes.find(c => /^[a-h][1-8]$/.test(c));
        if (!square) return;

        const piece = game.get(square);

        if (selectedSquare && selectedSquare !== square) {
            const moves = game.moves({ square: selectedSquare, verbose: true });
            const isValidMove = moves.some(m => m.to === square);

            if (isValidMove) {
                const targetPiece = game.get(square);
                const move = game.move({ from: selectedSquare, to: square, promotion: 'q' });

                if (move) {
                    removeHighlights(); // تنظيف فوري لمنع تداخل العناصر
                    board.position(game.fen()); // تحديث الرقعة
                    
                    playSound(targetPiece ? 'capture' : 'move');
                    selectedSquare = null;
                    
                    highlightCheckSquare();
                    updateStatus();
                    updateCapturedPieces();
                    checkGameOver();

                    if (game.turn() !== playerColor[0] && !game.game_over()) {
                        makeAiMove();
                    }
                    return;
                }
            }
        }

        if (piece && piece.color === playerColor[0]) {
            if (selectedSquare === square) {
                selectedSquare = null;
                removeHighlights();
                highlightCheckSquare();
            } else {
                selectedSquare = square;
                removeHighlights();
                highlightCheckSquare();
                $(`#board .square-${square}`).addClass('highlight-selected');
                showSquareHints(square);
            }
        }
    });
});

function showColorSelection() {
    document.querySelector('.play-trigger-btn').style.display = 'none';
    document.getElementById('colorSelectionBox').style.display = 'flex';
}

function startGame(color) {
    playerColor = color;
    selectedSquare = null;
    document.getElementById('startScreen').style.display = 'none';
    document.getElementById('gameOverModal').style.display = 'none';
    
    game.reset();
    initBot(); // تهيئة البوت الهجين هنا
    
    const config = {
        draggable: true,
        position: 'start',
        orientation: playerColor,
        pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png',
        snapbackSpeed: 50,
        snapSpeed: 50,
        moveSpeed: 200,
        onDragStart: onDragStart,
        onDrop: onDrop,
        onMouseoverSquare: onMouseoverSquare,
        onMouseoutSquare: onMouseoutSquare
    };
    
    board = Chessboard('board', config);
    updateStatus();
    updateCapturedPieces();

    if (playerColor === 'black') {
        window.setTimeout(makeAiMove, 300);
    }
}

function resetToMenu() {
    selectedSquare = null;
    document.getElementById('gameOverModal').style.display = 'none';
    document.getElementById('colorSelectionBox').style.display = 'none';
    document.querySelector('.play-trigger-btn').style.display = 'flex';
    document.getElementById('startScreen').style.display = 'flex';
}

// ==========================================
// منطق حركة البوت (هجين: Stockfish أو Alpha-Beta)
// ==========================================
function makeAiMove() {
    if (game.game_over()) return;
    updateStatus(true);

    if (useStockfish) {
        // استخدام Stockfish (مستوى 3000+)
        stockfish.postMessage('position fen ' + game.fen());
        stockfish.postMessage('go depth 15'); // عمق 15 يكفي لهزيمة أي لاعب بشري تقريباً
    } else {
        // استخدام البوت البديل القوي (مستوى 1600+) للفتح المحلي
        window.setTimeout(() => {
            const bestMove = getBestMove(game, 4);
            if (bestMove) {
                const moveStr = bestMove.from + bestMove.to + (bestMove.promotion || 'q');
                executeAiMove(moveStr);
            }
        }, 100);
    }
}

function executeAiMove(bestMoveStr) {
    const from = bestMoveStr.substring(0, 2);
    const to = bestMoveStr.substring(2, 4);
    const promotion = bestMoveStr.length > 4 ? bestMoveStr.substring(4, 5) : 'q';

    const targetPiece = game.get(to);
    game.move({ from, to, promotion });
    board.position(game.fen());
    
    playSound(targetPiece ? 'capture' : 'move');
    removeHighlights();
    highlightCheckSquare();
    updateStatus();
    updateCapturedPieces();
    checkGameOver();
}

// ==========================================
// خوارزمية Alpha-Beta Pruning (احتياطي قوي)
// ==========================================
function getBestMove(gameInstance, depth) {
    const moves = gameInstance.moves({ verbose: true });
    if (moves.length === 0) return null;

    moves.sort((a, b) => {
        const scoreA = a.captured ? pieceValue(a.captured) : 0;
        const scoreB = b.captured ? pieceValue(b.captured) : 0;
        return scoreB - scoreA;
    });

    let bestMove = null;
    let bestValue = -999999;
    const isMaximizing = gameInstance.turn() === 'w';

    for (let i = 0; i < moves.length; i++) {
        gameInstance.move(moves[i]);
        const value = minimax(gameInstance, depth - 1, -1000000, 1000000, !isMaximizing);
        gameInstance.undo();
        if (value > bestValue) {
            bestValue = value;
            bestMove = moves[i];
        }
    }
    return bestMove;
}

function minimax(gameInstance, depth, alpha, beta, isMaximizing) {
    if (depth === 0 || gameInstance.game_over()) return evaluateBoard(gameInstance);

    const moves = gameInstance.moves({ verbose: true });
    moves.sort((a, b) => {
        const scoreA = a.captured ? pieceValue(a.captured) : 0;
        const scoreB = b.captured ? pieceValue(b.captured) : 0;
        return scoreB - scoreA;
    });

    if (isMaximizing) {
        let maxEval = -999999;
        for (let i = 0; i < moves.length; i++) {
            gameInstance.move(moves[i]);
            const evaluation = minimax(gameInstance, depth - 1, alpha, beta, false);
            gameInstance.undo();
            maxEval = Math.max(maxEval, evaluation);
            alpha = Math.max(alpha, evaluation);
            if (beta <= alpha) break;
        }
        return maxEval;
    } else {
        let minEval = 999999;
        for (let i = 0; i < moves.length; i++) {
            gameInstance.move(moves[i]);
            const evaluation = minimax(gameInstance, depth - 1, alpha, beta, true);
            gameInstance.undo();
            minEval = Math.min(minEval, evaluation);
            beta = Math.min(beta, evaluation);
            if (beta <= alpha) break;
        }
        return minEval;
    }
}

const pieceWeights = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };
function pieceValue(p) { return pieceWeights[p.toLowerCase()] || 0; }

const pst = {
    p: [[0,0,0,0,0,0,0,0],[50,50,50,50,50,50,50,50],[10,10,20,30,30,20,10,10],[5,5,10,25,25,10,5,5],[0,0,0,20,20,0,0,0],[5,-5,-10,0,0,-10,-5,5],[5,10,10,-20,-20,10,10,5],[0,0,0,0,0,0,0,0]],
    n: [[-50,-40,-30,-30,-30,-30,-40,-50],[-40,-20,0,0,0,0,-20,-40],[-30,0,10,15,15,10,0,-30],[-30,5,15,20,20,15,5,-30],[-30,0,15,20,20,15,0,-30],[-30,5,10,15,15,10,5,-30],[-40,-20,0,5,5,0,-20,-40],[-50,-40,-30,-30,-30,-30,-40,-50]],
    b: [[-20,-10,-10,-10,-10,-10,-10,-20],[-10,0,0,0,0,0,0,-10],[-10,0,5,10,10,5,0,-10],[-10,5,5,10,10,5,5,-10],[-10,0,10,10,10,10,0,-10],[-10,10,10,10,10,10,10,-10],[-10,5,0,0,0,0,5,-10],[-20,-10,-10,-10,-10,-10,-10,-20]],
    r: [[0,0,0,0,0,0,0,0],[5,10,10,10,10,10,10,5],[-5,0,0,0,0,0,0,-5],[-5,0,0,0,0,0,0,-5],[-5,0,0,0,0,0,0,-5],[-5,0,0,0,0,0,0,-5],[-5,0,0,0,0,0,0,-5],[0,0,0,5,5,0,0,0]],
    q: [[-20,-10,-10,-5,-5,-10,-10,-20],[-10,0,0,0,0,0,0,-10],[-10,0,5,5,5,5,0,-10],[-5,0,5,5,5,5,0,-5],[0,0,5,5,5,5,0,-5],[-10,5,5,5,5,5,0,-10],[-10,0,5,0,0,0,0,-10],[-20,-10,-10,-5,-5,-10,-10,-20]],
    k: [[-30,-40,-40,-50,-50,-40,-40,-30],[-30,-40,-40,-50,-50,-40,-40,-30],[-30,-40,-40,-50,-50,-40,-40,-30],[-30,-40,-40,-50,-50,-40,-40,-30],[-20,-30,-30,-40,-40,-30,-30,-20],[-10,-20,-20,-20,-20,-20,-20,-10],[20,20,0,0,0,0,20,20],[20,30,10,0,0,10,30,20]]
};

function evaluateBoard(gameInstance) {
    let totalEvaluation = 0;
    const boardState = gameInstance.board();
    for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 8; j++) {
            const piece = boardState[i][j];
            if (piece) {
                let val = pieceWeights[piece.type];
                let pstVal = 0;
                if (pst[piece.type]) {
                    const row = piece.color === 'w' ? i : 7 - i;
                    pstVal = pst[piece.type][row][j];
                }
                const finalVal = val + pstVal;
                totalEvaluation += (piece.color === 'w' ? finalVal : -finalVal);
            }
        }
    }
    return gameInstance.turn() === 'w' ? totalEvaluation : -totalEvaluation;
}

// ==========================================
// وظائف الرقعة والتحكم (إصلاحات بصرية)
// ==========================================
function onDragStart(source, piece) {
    if (game.game_over()) return false;
    if ((playerColor === 'white' && piece.search(/^b/) !== -1) || 
        (playerColor === 'black' && piece.search(/^w/) !== -1)) return false;
    selectedSquare = null; 
    removeHighlights();
}

function onDrop(source, target) {
    const targetPiece = game.get(target);
    const move = game.move({ from: source, to: target, promotion: 'q' });
    if (move === null) return 'snapback';

    board.position(game.fen());
    playSound(targetPiece ? 'capture' : 'move');
    removeHighlights();
    highlightCheckSquare();
    updateStatus();
    updateCapturedPieces();
    checkGameOver();

    if (game.turn() !== playerColor[0] && !game.game_over()) {
        makeAiMove();
    }
}

function highlightCheckSquare() {
    removeHighlights();
    if (!game.in_check()) return;
    const boardState = game.board();
    const kingColor = game.turn();
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = boardState[r][c];
            if (piece && piece.type === 'k' && piece.color === kingColor) {
                const squareName = String.fromCharCode(97 + c) + (8 - r);
                $(`#board .square-${squareName}`).addClass('check-square');
            }
        }
    }
}

function showSquareHints(square) {
    const moves = game.moves({ square: square, verbose: true });
    if (moves.length === 0) return;
    moves.forEach(move => {
        const $sq = $(`#board .square-${move.to}`);
        if ($sq.length === 0) return;
        if (move.captured) {
            if ($sq.find('.kill-cross').length === 0) $sq.append('<div class="kill-cross">✕</div>');
        } else {
            if ($sq.find('.move-dot').length === 0) $sq.append('<div class="move-dot"></div>');
        }
    });
}

function onMouseoverSquare(square, piece) {
    if (!showHints || selectedSquare || !piece) return;
    if (piece.color === playerColor[0]) showSquareHints(square);
}

function onMouseoutSquare() {
    if (!selectedSquare) {
        removeHighlights();
        highlightCheckSquare();
    }
}

function removeHighlights() {
    $('.move-dot, .kill-cross').remove();
    $('#board .square-55d63').removeClass('check-square highlight-selected');
}

function updateCapturedPieces() {
    const history = game.history({ verbose: true });
    let whiteCaptured = [], blackCaptured = [];
    const symbolsWhite = { 'P': '♟', 'N': '♞', 'B': '♝', 'R': '♜', 'Q': '♛', 'K': '♚' };
    const symbolsBlack = { 'P': '♙', 'N': '♘', 'B': '♗', 'R': '♖', 'Q': '♕', 'K': '♔' };
    history.forEach(move => {
        if (move.captured) {
            const p = move.captured.toUpperCase();
            if (move.color === 'w') blackCaptured.push(symbolsBlack[p]);
            else whiteCaptured.push(symbolsWhite[p]);
        }
    });
    $('#opponentCaptured').text(playerColor === 'white' ? blackCaptured.join(' ') : whiteCaptured.join(' '));
}

function checkGameOver() {
    if (game.game_over()) {
        playSound('gameover');
        let msg = game.in_checkmate() 
            ? (game.turn() === playerColor[0] ? "لا تيأس، فالسهم يحتاج أن يرجع للوراء لينطلق بقوة." : "أحسنت، لقد تغلبت على كيوتاكا أيانوكوجي.")
            : "لقد نجوت هذه المرة بأعجوبة (تعادل).";
        $('#winnerText').text(msg);
        document.getElementById('gameOverModal').style.display = 'flex';
    }
}

function updateStatus(isThinking = false) {
    const txt = isThinking 
        ? (useStockfish ? "أيانوكوجي يحسب 15 خطوة للأمام..." : "أيانوكوجي يحلل الموقف...") 
        : (game.turn() === playerColor[0] ? "دورك الآن" : "دور أيانوكوجي...");
    $('#status').text(txt);
}
