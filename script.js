var board = null;
var game = new Chess();
var playerColor = 'white';
var showHints = true;
var selectedSquare = null;

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
    document.body.style.backgroundImage = `linear-gradient(rgba(20, 14, 10, 0.88), rgba(20, 14, 10, 0.88)), url('images/${randomBg}.jpg')`;

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
        if (!showHints) {
            selectedSquare = null;
            removeHighlights();
        }
    });

    $(document).on('click', '#board .square-55d63', function() {
        if (!showHints || game.game_over()) return;
        
        var square = null;
        var classes = $(this).attr('class').split(/\s+/);
        for (var i = 0; i < classes.length; i++) {
            if (classes[i].length === 2 && /^[a-h][1-8]$/.test(classes[i])) {
                square = classes[i];
                break;
            }
        }
        if (!square) return;

        var piece = game.get(square);

        if (selectedSquare && selectedSquare !== square) {
            var moves = game.moves({ square: selectedSquare, verbose: true });
            var targetMatch = false;
            for (var m = 0; m < moves.length; m++) {
                if (moves[m].to === square) {
                    targetMatch = true;
                    break;
                }
            }

            if (targetMatch) {
                var targetPiece = game.get(square);
                var move = game.move({
                    from: selectedSquare,
                    to: square,
                    promotion: 'q'
                });

                if (move !== null) {
                    // إزالة false للسماح بالأنيميشن الطبيعي
                    board.position(game.fen());
                    if (targetPiece) playSound('capture');
                    else playSound('move');

                    selectedSquare = null;
                    removeHighlights();
                    highlightCheckSquare();
                    updateStatus();
                    updateCapturedPieces();
                    checkGameOver();

                    var aiTurnCheck = (playerColor === 'white') ? 'b' : 'w';
                    if (game.turn() === aiTurnCheck && !game.game_over()) {
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
                $('#board .square-' + square).addClass('highlight-selected');
                showSquareHints(square, piece);
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
    var config = {
        draggable: true,
        position: 'start',
        orientation: playerColor,
        pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png',
        snapbackSpeed: 50,
        snapSpeed: 50,
        onDragStart: onDragStart,
        onDrop: onDrop,
        onMouseoverSquare: onMouseoverSquare,
        onMouseoutSquare: onMouseoutSquare
    };
    
    board = Chessboard('board', config);
    updateStatus();
    updateCapturedPieces();

    if (playerColor === 'black') {
        window.setTimeout(makeAiMove, 100);
    }
}

function resetToMenu() {
    selectedSquare = null;
    document.getElementById('gameOverModal').style.display = 'none';
    document.getElementById('colorSelectionBox').style.display = 'none';
    document.querySelector('.play-trigger-btn').style.display = 'flex';
    document.getElementById('startScreen').style.display = 'flex';
}

function makeAiMove() {
    if (game.game_over()) return;
    updateStatus(true);

    window.setTimeout(function() {
        var bestMove = calculateBestMove(3); 
        if (bestMove) {
            var isCapture = bestMove.captured;
            
            highlightAiMove(bestMove);

            window.setTimeout(function() {
                game.move(bestMove);
                // إزالة false للسماح بالأنيميشن الطبيعي للروبوت
                board.position(game.fen());
                
                if (isCapture) playSound('capture');
                else playSound('move');

                removeHighlights();
                highlightCheckSquare();
                updateStatus();
                updateCapturedPieces();
                checkGameOver();
            }, 250);
        }
    }, 50); 
}

function highlightAiMove(move) {
    removeHighlights();
    var $fromSq = $('#board .square-' + move.from);
    $fromSq.addClass('highlight-ai-source');
    showSquareHints(move.from, game.get(move.from));
}

function calculateBestMove(depth) {
    var moves = game.moves({ verbose: true });
    if (moves.length === 0) return null;

    moves.sort(function(a, b) {
        return (b.captured ? 100 : 0) - (a.captured ? 100 : 0);
    });

    var bestValue = -999999;
    var bestMove = moves[0];

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

const pieceWeights = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };

const pst = {
    p: [
        [ 0,  0,  0,  0,  0,  0,  0,  0],
        [50, 50, 50, 50, 50, 50, 50, 50],
        [10, 10, 20, 30, 30, 20, 10, 10],
        [ 5,  5, 10, 25, 25, 10,  5,  5],
        [ 0,  0,  0, 20, 20,  0,  0,  0],
        [ 5, -5,-10,  0,  0,-10, -5,  5],
        [ 5, 10, 10,-20,-20, 10, 10,  5],
        [ 0,  0,  0,  0,  0,  0,  0,  0]
    ],
    n: [
        [-50,-40,-30,-30,-30,-30,-40,-50],
        [-40,-20,  0,  0,  0,  0,-20,-40],
        [-30,  0, 10, 15, 15, 10,  0,-30],
        [-30,  5, 15, 20, 20, 15,  5,-30],
        [-30,  0, 15, 20, 20, 15,  0,-30],
        [-30,  5, 10, 15, 15, 10,  5,-30],
        [-40,-20,  0,  5,  5,  0,-20,-40],
        [-50,-40,-30,-30,-30,-30,-40,-50]
    ],
    b: [
        [-20,-10,-10,-10,-10,-10,-10,-20],
        [-10,  0,  0,  0,  0,  0,  0,-10],
        [-10,  0,  5, 10, 10,  5,  0,-10],
        [-10,  5,  5, 10, 10,  5,  5,-10],
        [-10,  0, 10, 10, 10, 10,  0,-10],
        [-10, 10, 10, 10, 10, 10, 10,-10],
        [-10,  5,  0,  0,  0,  0,  5,-10],
        [-20,-10,-10,-10,-10,-10,-10,-20]
    ],
    r: [
        [  0,  0,  0,  0,  0,  0,  0,  0],
        [  5, 10, 10, 10, 10, 10, 10,  5],
        [ -5,  0,  0,  0,  0,  0,  0, -5],
        [ -5,  0,  0,  0,  0,  0,  0, -5],
        [ -5,  0,  0,  0,  0,  0,  0, -5],
        [ -5,  0,  0,  0,  0,  0,  0, -5],
        [ -5,  0,  0,  0,  0,  0,  0, -5],
        [  0,  0,  0,  5,  5,  0,  0,  0]
    ],
    q: [
        [-20,-10,-10, -5, -5,-10,-10,-20],
        [-10,  0,  0,  0,  0,  0,  0,-10],
        [-10,  0,  5,  5,  5,  5,  0,-10],
        [ -5,  0,  5,  5,  5,  5,  0, -5],
        [  0,  0,  5,  5,  5,  5,  0, -5],
        [-10,  5,  5,  5,  5,  5,  0,-10],
        [-10,  0,  5,  0,  0,  0,  0,-10],
        [-20,-10,-10, -5, -5,-10,-10,-20]
    ],
    k: [
        [-30,-40,-40,-50,-50,-40,-40,-30],
        [-30,-40,-40,-50,-50,-40,-40,-30],
        [-30,-40,-40,-50,-50,-40,-40,-30],
        [-30,-40,-40,-50,-50,-40,-40,-30],
        [-20,-30,-30,-40,-40,-30,-30,-20],
        [-10,-20,-20,-20,-20,-20,-20,-10],
        [ 20, 20,  0,  0,  0,  0, 20, 20],
        [ 20, 30, 10,  0,  0, 10, 30, 20]
    ]
};

function evaluateBoard() {
    var totalEvaluation = 0;
    var boardState = game.board();
    for (var i = 0; i < 8; i++) {
        for (var j = 0; j < 8; j++) {
            var piece = boardState[i][j];
            if (piece) {
                var val = pieceWeights[piece.type];
                var pstVal = 0;
                
                if (pst[piece.type]) {
                    var row = piece.color === 'w' ? i : 7 - i;
                    var col = j; 
                    pstVal = pst[piece.type][row][col];
                }
                
                var finalVal = val + pstVal;
                totalEvaluation += (piece.color === 'w' ? finalVal : -finalVal);
            }
        }
    }
    return playerColor === 'white' ? -totalEvaluation : totalEvaluation;
}

function onDragStart(source, piece, position, orientation) {
    if (game.game_over()) return false;
    if (playerColor === 'white' && piece.search(/^b/) !== -1) return false;
    if (playerColor === 'black' && piece.search(/^w/) !== -1) return false;
    selectedSquare = null; 
    removeHighlights();
}

function onDrop(source, target) {
    var targetPiece = game.get(target);
    var move = game.move({
        from: source,
        to: target,
        promotion: 'q'
    });

    if (move === null) return 'snapback';

    // إزالة false للسماح بالأنيميشن الطبيعي عند الإفلات
    board.position(game.fen());

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

function showSquareHints(square, piece) {
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

function onMouseoverSquare(square, piece) {
    if (!showHints || selectedSquare) return;
    showSquareHints(square, piece);
}

function onMouseoutSquare(square, piece) {
    if (selectedSquare) return;
    removeHighlights();
    highlightCheckSquare();
}

function removeHighlights() {
    $('.move-dot').remove();
    $('.kill-cross').remove();
    $('.castling-arrows').remove();
    $('#board .square-55d63').removeClass('check-square highlight-selected highlight-ai-source');
}

function updateCapturedPieces() {
    var history = game.history({ verbose: true });
    var whiteCaptured = [], blackCaptured = [];

    var symbolsWhite = { 'P': '♟', 'N': '♞', 'B': '♝', 'R': '♜', 'Q': '♛', 'K': '♚' };
    var symbolsBlack = { 'P': '♙', 'N': '♘', 'B': '♗', 'R': '♖', 'Q': '♕', 'K': '♔' };

    for (var i = 0; i < history.length; i++) {
        if (history[i].captured) {
            var p = history[i].captured.toUpperCase();
            if (history[i].color === 'w') {
                blackCaptured.push(symbolsBlack[p]);
            } else {
                whiteCaptured.push(symbolsWhite[p]);
            }
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
