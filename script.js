let board = null;
let game = new Chess();
let playerColor = 'white';
let showHints = true;
let selectedSquare = null;
let stockfish = null;

// 1. تهيئة الخلفيات العشوائية (1.jfif, 2.jfif, 3.jfif)
window.addEventListener('DOMContentLoaded', (event) => {
    var randomBg = Math.floor(Math.random() * 3) + 1;
    document.body.style.backgroundImage = `linear-gradient(rgba(15, 10, 7, 0.85), rgba(15, 10, 7, 0.85)), url('images/${randomBg}.jfif')`;

    document.getElementById('fullscreenToggle').addEventListener('click', function() {
        if (!document.fullscreenElement) document.documentElement.requestFullscreen();
        else if (document.exitFullscreen) document.exitFullscreen();
    });

    document.getElementById('hintsToggle').addEventListener('click', function() {
        showHints = !showHints;
        this.classList.toggle('active-hint', showHints);
        if (!showHints) { selectedSquare = null; removeHighlights(); }
    });

    $(document).on('click', '#board .square-55d63', function() {
        if (!showHints || game.game_over()) return;
        var square = null;
        var classes = $(this).attr('class').split(/\s+/);
        for (var i = 0; i < classes.length; i++) {
            if (classes[i].length === 2 && /^[a-h][1-8]$/.test(classes[i])) { square = classes[i]; break; }
        }
        if (!square) return;

        var piece = game.get(square);

        if (selectedSquare && selectedSquare !== square) {
            var moves = game.moves({ square: selectedSquare, verbose: true });
            var targetMatch = moves.some(m => m.to === square);

            if (targetMatch) {
                var targetPiece = game.get(square);
                var move = game.move({ from: selectedSquare, to: square, promotion: 'q' });

                if (move !== null) {
                    // لا نقوم بتحديث الرقعة هنا! نترك أنيميشن السحب يكمل بشكل طبيعي.
                    playSound(targetPiece ? 'capture' : 'move');
                    selectedSquare = null;
                    removeHighlights();
                    highlightCheckSquare();
                    updateStatus();
                    updateCapturedPieces();
                    checkGameOver();

                    var aiTurnCheck = (playerColor === 'white') ? 'b' : 'w';
                    if (game.turn() === aiTurnCheck && !game.game_over()) makeAiMove();
                    return;
                }
            }
        }

        if (piece && piece.color === playerColor[0]) {
            if (selectedSquare === square) {
                selectedSquare = null; removeHighlights(); highlightCheckSquare();
            } else {
                selectedSquare = square; removeHighlights(); highlightCheckSquare();
                $('#board .square-' + square).addClass('highlight-selected');
                showSquareHints(square);
            }
        }
    });
});

// 2. تهيئة Stockfish (مستوى 3000+ ELO)
function initStockfish() {
    if (!stockfish) {
        try {
            stockfish = new Worker('https://cdnjs.cloudflare.com/ajax/libs/stockfish.js/10.0.0/stockfish.js');
            stockfish.onmessage = function(event) {
                if (event.data.startsWith('bestmove')) {
                    const bestMove = event.data.split(' ')[1];
                    if (bestMove && bestMove !== '(none)') executeAiMove(bestMove);
                }
            };
        } catch (e) { console.error("فشل تحميل Stockfish:", e); }
    }
}

// نظام الصوت
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playSound(type) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    osc.connect(gainNode); gainNode.connect(audioCtx.destination);
    if (type === 'move') {
        osc.frequency.setValueAtTime(400, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        osc.start(); osc.stop(audioCtx.currentTime + 0.1);
    } else if (type === 'capture') {
        osc.frequency.setValueAtTime(250, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(120, audioCtx.currentTime + 0.2);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
        osc.start(); osc.stop(audioCtx.currentTime + 0.2);
    } else if (type === 'gameover') {
        osc.frequency.setValueAtTime(600, audioCtx.currentTime);
        osc.frequency.setValueAtTime(400, audioCtx.currentTime + 0.15);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
        osc.start(); osc.stop(audioCtx.currentTime + 0.4);
    }
}

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
    initStockfish();
    
    var config = {
        draggable: true,
        position: 'start',
        orientation: playerColor,
        pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png',
        snapbackSpeed: 50,
        snapSpeed: 50,
        moveSpeed: 150, // سرعة أنيميشن سريعة جداً وسلسة
        onDragStart: onDragStart,
        onDrop: onDrop,
        onSnapEnd: onSnapEnd, // الدالة السحرية لمنع التكدس
        onMouseoverSquare: onMouseoverSquare,
        onMouseoutSquare: onMouseoutSquare
    };
    
    board = Chessboard('board', config);
    updateStatus();
    updateCapturedPieces();

    if (playerColor === 'black') window.setTimeout(makeAiMove, 300);
}

function resetToMenu() {
    selectedSquare = null;
    if (board) board.destroy(); // تدمير الرقعة لمنع تراكم العناصر
    board = null;
    document.getElementById('gameOverModal').style.display = 'none';
    document.getElementById('colorSelectionBox').style.display = 'none';
    document.querySelector('.play-trigger-btn').style.display = 'flex';
    document.getElementById('startScreen').style.display = 'flex';
}

// 3. منطق البوت السريع والذكي
function makeAiMove() {
    if (game.game_over()) return;
    updateStatus(true);
    stockfish.postMessage('position fen ' + game.fen());
    stockfish.postMessage('go depth 15'); // عمق 15 = قوة خارقة وسرعة البرق
}

function executeAiMove(bestMoveStr) {
    const from = bestMoveStr.substring(0, 2);
    const to = bestMoveStr.substring(2, 4);
    const promotion = bestMoveStr.length > 4 ? bestMoveStr.substring(4, 5) : 'q';

    const targetPiece = game.get(to);
    game.move({ from, to, promotion });
    
    // 🔥 التحديث الفوري بدون أنيميشن يمنع تكدس القطع تماماً
    board.position(game.fen(), false);
    
    playSound(targetPiece ? 'capture' : 'move');
    removeHighlights();
    highlightCheckSquare();
    updateStatus();
    updateCapturedPieces();
    checkGameOver();
}

function onDragStart(source, piece) {
    if (game.game_over()) return false;
    if ((playerColor === 'white' && piece.search(/^b/) !== -1) || 
        (playerColor === 'black' && piece.search(/^w/) !== -1)) return false;
    selectedSquare = null; 
    removeHighlights();
}

function onDrop(source, target) {
    var targetPiece = game.get(target);
    var move = game.move({ from: source, to: target, promotion: 'q' });

    if (move === null) return 'snapback';

    // 🔥 لا نقوم بتحديث الرقعة هنا! نترك أنيميشن السحب يكمل بشكل طبيعي.
    playSound(targetPiece ? 'capture' : 'move');
    removeHighlights();
    highlightCheckSquare();
    updateStatus();
    updateCapturedPieces();
    checkGameOver();

    var aiTurnCheck = (playerColor === 'white') ? 'b' : 'w';
    if (game.turn() === aiTurnCheck && !game.game_over()) makeAiMove();
}

// 🔥 الدالة السحرية: تُستدعى بعد انتهاء أنيميشن السحب
function onSnapEnd() {
    // تجبر المكتبة على مسح كل القطع وإعادة رسمها فوراً (يمنع الشبح والتكدس)
    board.position(game.fen(), false);
}

function highlightCheckSquare() {
    removeHighlights();
    if (!game.in_check()) return;
    var boardState = game.board();
    var kingColor = game.turn();
    for (var r = 0; r < 8; r++) {
        for (var c = 0; c < 8; c++) {
            var piece = boardState[r][c];
            if (piece && piece.type === 'k' && piece.color === kingColor) {
                var squareName = String.fromCharCode(97 + c) + (8 - r);
                $('#board .square-' + squareName).addClass('check-square');
            }
        }
    }
}

function showSquareHints(square) {
    var moves = game.moves({ square: square, verbose: true });
    if (moves.length === 0) return;
    for (var i = 0; i < moves.length; i++) {
        var targetSquare = moves[i].to;
        var $sq = $('#board .square-' + targetSquare);
        if (moves[i].captured) {
            if ($sq.length > 0 && $sq.find('.kill-cross').length === 0) $sq.append('<div class="kill-cross">✕</div>');
        } else {
            if ($sq.length > 0 && $sq.find('.move-dot').length === 0) $sq.append('<div class="move-dot"></div>');
        }
    }
}

function onMouseoverSquare(square, piece) {
    if (!showHints || selectedSquare || !piece) return;
    if (piece.color === playerColor[0]) showSquareHints(square);
}

function onMouseoutSquare(square, piece) {
    if (selectedSquare) return;
    removeHighlights();
    highlightCheckSquare();
}

function removeHighlights() {
    $('.move-dot, .kill-cross').remove();
    $('#board .square-55d63').removeClass('check-square highlight-selected');
}

function updateCapturedPieces() {
    var history = game.history({ verbose: true });
    var whiteCaptured = [], blackCaptured = [];
    var symbolsWhite = { 'P': '♟', 'N': '♞', 'B': '♝', 'R': '♜', 'Q': '♛', 'K': '♚' };
    var symbolsBlack = { 'P': '♙', 'N': '♘', 'B': '♗', 'R': '♖', 'Q': '♕', 'K': '♔' };
    for (var i = 0; i < history.length; i++) {
        if (history[i].captured) {
            var p = history[i].captured.toUpperCase();
            if (history[i].color === 'w') blackCaptured.push(symbolsBlack[p]);
            else whiteCaptured.push(symbolsWhite[p]);
        }
    }
    if (playerColor === 'white') $('#opponentCaptured').text(blackCaptured.join(' '));
    else $('#opponentCaptured').text(whiteCaptured.join(' '));
}

function checkGameOver() {
    if (game.game_over()) {
        playSound('gameover');
        var msg = "";
        if (game.in_checkmate()) {
            msg = game.turn() === playerColor[0] 
                ? "لا تيأس إذا رجعت خطوة للوراء، فلا تنسَ أن السهم يحتاج أن ترجعه للوراء لينطلق بقوة إلى الأمام."
                : "أحسنت، تغلبت على أيانوكوجي كيوتاكا.";
        } else {
            msg = "لقد نجوت هذه المرة بأعجوبة (تعادل).";
        }
        $('#winnerText').text(msg);
        document.getElementById('gameOverModal').style.display = 'flex';
    }
}

function updateStatus(isThinking = false) {
    var txt = isThinking ? "أيانوكوجي يحلل الموقف بعمق وبصمت..." : (game.turn() === playerColor[0] ? "دورك الآن (قم بتحريك قطعتك)" : "دور أيانوكوجي...");
    $('#status').text(txt);
}
