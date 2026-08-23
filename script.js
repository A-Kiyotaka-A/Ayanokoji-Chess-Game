var board = null;
var game = new Chess();
var playerColor = 'white';
var showHints = true;

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playSound(type) {
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    if (type === 'move') {
        osc.frequency.setValueAtTime(400, audioCtx.currentTime);
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.1);
    } else if (type === 'capture') {
        osc.frequency.setValueAtTime(250, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(120, audioCtx.currentTime + 0.2);
        gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.2);
    } else if (type === 'gameover') {
        osc.frequency.setValueAtTime(600, audioCtx.currentTime);
        osc.frequency.setValueAtTime(400, audioCtx.currentTime + 0.15);
        gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.4);
    }
}

window.addEventListener('DOMContentLoaded', (event) => {
    var randomBg = Math.floor(Math.random() * 3) + 1;
    document.body.style.backgroundImage = `linear-gradient(rgba(7, 9, 14, 0.85), rgba(7, 9, 14, 0.85)), url('images/${randomBg}.jpg')`;

    document.getElementById('fullscreenToggle').addEventListener('click', function() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
        } else {
            if (document.exitFullscreen) document.exitFullscreen();
        }
    });

    document.getElementById('hintsToggle').addEventListener('click', function() {
        showHints = !showHints;
        this.style.opacity = showHints ? '1' : '0.4';
    });
});

function showColorSelection() {
    document.querySelector('.play-trigger-btn').style.display = 'none';
    document.getElementById('colorSelectionBox').style.display = 'flex';
}

function startGame(color) {
    playerColor = color;
    document.getElementById('startScreen').style.display = 'none';
    document.getElementById('gameOverModal').style.display = 'none';
    
    game.reset();
    var config = {
        draggable: true,
        position: 'start',
        orientation: playerColor,
        onDragStart: onDragStart,
        onDrop: onDrop,
        onMouseoverSquare: onMouseoverSquare,
        onMouseoutSquare: onMouseoutSquare,
        onSnapEnd: function() { board.position(game.fen()); }
    };
    
    board = Chessboard('board', config);
    updateStatus();
    updateCapturedPieces();

    if (playerColor === 'black') {
        window.setTimeout(makeAiMove, 300);
    }
}

// إعادة المباراة تبدأ الدور مباشرة دون الرجوع للقائمة الرئيسية
function restartMatch() {
    document.getElementById('gameOverModal').style.display = 'none';
    startGame(playerColor);
}

function resetToMenu() {
    document.getElementById('gameOverModal').style.display = 'none';
    document.getElementById('colorSelectionBox').style.display = 'none';
    document.querySelector('.play-trigger-btn').style.display = 'flex';
    document.getElementById('startScreen').style.display = 'flex';
}

function makeAiMove() {
    if (game.game_over()) return;
    updateStatus(true);

    window.setTimeout(function() {
        var bestMove = calculateBestMove(4); 
        if (bestMove) {
            var isCapture = bestMove.captured;
            game.move(bestMove);
            board.position(game.fen());
            
            if (isCapture) playSound('capture');
            else playSound('move');

            highlightCheckSquare();
            updateStatus();
            updateCapturedPieces();
            checkGameOver();
        }
    }, 100);
}

function calculateBestMove(depth) {
    var moves = game.moves({ verbose: true });
    if (moves.length === 0) return null;

    var bestValue = -999999;
    var bestMove = moves[0];

    moves.sort(function(a, b) {
        return (b.captured ? 20 : 0) - (a.captured ? 20 : 0);
    });

    for (var i = 0; i < moves.length; i++) {
        game.move(moves[i]);
        var value = minimax(depth - 1, -1000000, 1000000, false);
        game.undo();
        if (value > bestValue) {
            bestValue = value;
            bestMove = moves[i];
        }
    }
    return bestMove;
}

function minimax(depth, alpha, beta, isMaximizing) {
    if (depth === 0 || game.game_over()) {
        return evaluateBoard();
    }

    var moves = game.moves({ verbose: true });
    if (isMaximizing) {
        var maxEval = -999999;
        for (var i = 0; i < moves.length; i++) {
            game.move(moves[i]);
            var evaluation = minimax(depth - 1, alpha, beta, false);
            game.undo();
            maxEval = Math.max(maxEval, evaluation);
            alpha = Math.max(alpha, evaluation);
            if (beta <= alpha) break;
        }
        return maxEval;
    } else {
        var minEval = 999999;
        for (var i = 0; i < moves.length; i++) {
            game.move(moves[i]);
            var evaluation = minimax(depth - 1, alpha, beta, true);
            game.undo();
            minEval = Math.min(minEval, evaluation);
            beta = Math.min(beta, evaluation);
            if (beta <= alpha) break;
        }
        return minEval;
    }
}

function evaluateBoard() {
    var totalEvaluation = 0;
    var boardState = game.board();
    for (var i = 0; i < 8; i++) {
        for (var j = 0; j < 8; j++) {
            var piece = boardState[i][j];
            if (piece) {
                totalEvaluation += getAdvancedPieceValue(piece, i, j);
            }
        }
    }
    return playerColor === 'white' ? -totalEvaluation : totalEvaluation;
}

function getAdvancedPieceValue(piece, r, c) {
    var weights = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };
    var val = weights[piece.type];

    if ((r === 3 || r === 4) && (c === 3 || c === 4)) {
        val += 25;
    }

    if (piece.type === 'p') {
        val += (piece.color === 'w' ? (7 - r) : r) * 8;
    }

    return piece.color === 'w' ? val : -val;
}

function onDragStart(source, piece, position, orientation) {
    if (game.game_over()) return false;
    if (playerColor === 'white' && piece.search(/^b/) !== -1) return false;
    if (playerColor === 'black' && piece.search(/^w/) !== -1) return false;
}

function onDrop(source, target) {
    var targetPiece = game.get(target);
    var move = game.move({
        from: source,
        to: target,
        promotion: 'q'
    });

    if (move === null) return 'snapback';

    if (targetPiece) playSound('capture');
    else playSound('move');

    removeHighlights();
    highlightCheckSquare();
    updateStatus();
    updateCapturedPieces();
    checkGameOver();

    var aiTurnCheck = (playerColor === 'white') ? 'b' : 'w';
    if (game.turn() === aiTurnCheck && !game.game_over()) {
        makeAiMove();
    }
}

function highlightCheckSquare() {
    removeCheckHighlights();
    if (game.in_check()) {
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
}

function removeCheckHighlights() {
    $('#board .square-55d63').removeClass('check-square');
}

function onMouseoverSquare(square, piece) {
    if (!showHints) return;
    var moves = game.moves({ square: square, verbose: true });
    if (moves.length === 0) return;

    for (var i = 0; i < moves.length; i++) {
        var targetSquare = moves[i].to;
        var $sq = $('#board .square-' + targetSquare);

        if (moves[i].captured) {
            if ($sq.length > 0 && $sq.find('.kill-cross').length === 0) {
                $sq.append('<div class="kill-cross">✕</div>');
            }
        } else if (moves[i].san === 'O-O' || moves[i].san === 'O-O-O' || (piece && piece.type === 'k' && Math.abs(square.charCodeAt(0) - targetSquare.charCodeAt(0)) > 1)) {
            if ($sq.length > 0 && $sq.find('.castling-arrows').length === 0) {
                $sq.append('<div class="castling-arrows"><span style="display:block;">➔</span><span style="display:block; margin-top:-8px;">⬅</span></div>');
            }
        } else {
            if ($sq.length > 0 && $sq.find('.move-dot').length === 0) {
                $sq.append('<div class="move-dot"></div>');
            }
        }
    }
}

function onMouseoutSquare(square, piece) {
    removeHighlights();
    highlightCheckSquare();
}

function removeHighlights() {
    $('.move-dot').remove();
    $('.kill-cross').remove();
    $('.castling-arrows').remove();
}

function updateCapturedPieces() {
    var history = game.history({ verbose: true });
    var whiteCaptured = [], blackCaptured = [];

    for (var i = 0; i < history.length; i++) {
        if (history[i].captured) {
            var p = history[i].captured.toUpperCase();
            var sym = { 'P': 'P', 'N': 'N', 'B': 'B', 'R': 'R', 'Q': 'Q', 'K': 'K' }[p];
            if (history[i].color === 'w') blackCaptured.push(sym);
            else whiteCaptured.push(sym);
        }
    }

    if (playerColor === 'white') {
        $('#opponentCaptured').text(blackCaptured.join(' '));
    } else {
        $('#opponentCaptured').text(whiteCaptured.join(' '));
    }
}

function checkGameOver() {
    if (game.game_over()) {
        playSound('gameover');
        var msg = "";
        if (game.in_checkmate()) {
            if (game.turn() === playerColor[0]) {
                msg = "لا تيأس إذا رجعت خطوة للوراء، فلا تنسَ أن السهم يحتاج أن ترجعه للوراء لينطلق بقوة إلى الأمام.";
            } else {
                msg = "أحسنت، تغلبت على أيانوكوجي كيوتاكا.";
            }
        } else {
            msg = "لقد نجوت هذه المرة بأعجوبة.";
        }
        $('#winnerText').text(msg);
        document.getElementById('gameOverModal').style.display = 'flex';
    }
}

function updateStatus(isThinking = false) {
    var txt = isThinking ? "أيانوكوجي يحلل عمق التحركات..." : (game.turn() === playerColor[0] ? "دورك الآن (قم بتحريك قطعتك)" : "دور أيانوكوجي...");
    $('#status').text(txt);
}
