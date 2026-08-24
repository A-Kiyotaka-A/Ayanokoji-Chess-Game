let board = null;
let game = new Chess();
let playerColor = 'white';
let showHints = true;
let selectedSquare = null;
let stockfish = null;

// 1. تهيئة Stockfish (المحرك الأقوى والأسرع)
function initStockfish() {
    if (!stockfish) {
        stockfish = new Worker('https://cdnjs.cloudflare.com/ajax/libs/stockfish.js/10.0.0/stockfish.js');
        stockfish.onmessage = function(event) {
            if (event.data.startsWith('bestmove')) {
                const bestMove = event.data.split(' ')[1];
                if (bestMove && bestMove !== '(none)') {
                    executeAiMove(bestMove);
                }
            }
        };
    }
}

// نظام صوتي بسيط
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
    }
}

window.addEventListener('DOMContentLoaded', () => {
    document.getElementById('hintsToggle').addEventListener('click', function() {
        showHints = !showHints;
        this.classList.toggle('active-hint', showHints);
        if (!showHints) { selectedSquare = null; removeHighlights(); }
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
                    // 🔥 الإصلاح الحاسم: مسح التلميحات أولاً، ثم التحديث الفوري للرقعة
                    removeHighlights();
                    board.position(game.fen(), false); // false يمنع الأنيميشن المتراكم ويسبب القطع المزدوجة
                    
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
                selectedSquare = null; removeHighlights(); highlightCheckSquare();
            } else {
                selectedSquare = square;
                removeHighlights(); highlightCheckSquare();
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
    initStockfish(); // تشغيل البوت القوي
    
    const config = {
        draggable: true,
        position: 'start',
        orientation: playerColor,
        pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png',
        snapbackSpeed: 50, snapSpeed: 50, moveSpeed: 200,
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
    document.querySelector('.play-trigger-btn').style.display = 'block';
    document.getElementById('startScreen').style.display = 'flex';
}

// 2. منطق البوت السريع والذكي
function makeAiMove() {
    if (game.game_over()) return;
    updateStatus(true);
    // إرسال الوضعية للمحرك
    stockfish.postMessage('position fen ' + game.fen());
    // عمق 12 في Stockfish يعطي قوة ~2500+ ELO وسرعة أقل من ثانية
    stockfish.postMessage('go depth 12'); 
}

function executeAiMove(bestMoveStr) {
    const from = bestMoveStr.substring(0, 2);
    const to = bestMoveStr.substring(2, 4);
    const promotion = bestMoveStr.length > 4 ? bestMoveStr.substring(4, 5) : 'q';

    const targetPiece = game.get(to);
    game.move({ from, to, promotion });
    
    // تحديث فوري لمنع تكرار القطع
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
    const targetPiece = game.get(target);
    const move = game.move({ from: source, to: target, promotion: 'q' });
    if (move === null) return 'snapback';

    // 🔥 التحديث الفوري هو الحل الوحيد لمشكلة القطع المزدوجة
    board.position(game.fen(), false);
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
    if (!selectedSquare) { removeHighlights(); highlightCheckSquare(); }
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
        let msg = game.in_checkmate() 
            ? (game.turn() === playerColor[0] ? "لقد خسرت. السهم يحتاج أن يرجع للوراء لينطلق بقوة." : "أحسنت، لقد تغلبت على أيانوكوجي.")
            : "تعادل.";
        $('#winnerText').text(msg);
        document.getElementById('gameOverModal').style.display = 'flex';
    }
}

function updateStatus(isThinking = false) {
    const txt = isThinking ? "أيانوكوجي يحسب النقلات..." : (game.turn() === playerColor[0] ? "دورك الآن" : "دور أيانوكوجي...");
    $('#status').text(txt);
}
