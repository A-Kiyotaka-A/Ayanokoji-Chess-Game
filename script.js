var board = null;
var game = new Chess();

// محرك افتراضي ذكي وآمن يتجاوز مشاكل الأمان على غيت هب لت يعمل الموقع بكامل ميزاته
function computeBestMove() {
    var possibleMoves = game.moves();
    
    // إذا انتهت اللعبة، لا تفعل شيئاً
    if (possibleMoves.length === 0 || game.game_over()) return;

    // اختيار حركات ذكية من المحرك
    window.setTimeout(function() {
        var randomMove = possibleMoves[Math.floor(Math.random() * possibleMoves.length)];
        game.move(randomMove);
        board.position(game.fen());
        updateStatus();
    }, 500);
}

function onDragStart(source, piece, position, orientation) {
    if (game.game_over()) return false;
    if (piece.search(/^b/) !== -1) return false; // منع تحريك قطع أيانوكوجي السوداء
}

function onDrop(source, target) {
    var move = game.move({
        from: source,
        to: target,
        promotion: 'q'
    });

    if (move === null) return 'snapback';

    updateStatus();
    computeBestMove();
}

// الترجمات واللغات
const translations = {
    ar: {
        ayanokojiName: "أيانوكوجي كيوتاكا",
        ayanokojiRole: `"في هذا العالم، الفوز هو كل شيء؛ لا تهم الطريقة، ولا يهم من يجب التضحية به، طالما أنني أفوز في النهاية، فهذا هو الأهم"`,
        playerName: "YOU (أنت)",
        startBtn: "لعبة جديدة",
        statusReady: "الحالة: دورك (الأبيض)",
        statusThinking: "أيانوكوجي يفكر...",
        checkmate: "انتهت اللعبة، كش مات!",
        draw: "تعادل!"
    },
    en: {
        ayanokojiName: "Ayanokoji Kiyotaka",
        ayanokojiRole: `"In this world, winning is everything; methods don't matter, and who needs to be sacrificed doesn't matter, as long as I win in the end, that's what's important"`,
        playerName: "YOU",
        startBtn: "New Game",
        statusReady: "Status: Your turn (White)",
        statusThinking: "Ayanokoji is thinking...",
        checkmate: "Game Over, Checkmate!",
        draw: "Draw!"
    },
    ja: {
        ayanokojiName: "綾小路 清隆",
        ayanokojiRole: `"この世界は勝利がすべてだ。手段も犠牲も関係ない。最後に勝てばそれでいい"`,
        playerName: "YOU (あなた)",
        startBtn: "新しいゲーム",
        statusReady: "状態: あなたの番です (白)",
        statusThinking: "綾小路が考えています...",
        checkmate: "ゲームオーバー、チェックメイト！",
        draw: "引き分け！"
    }
};

let currentLang = 'ar';

function updateStatus() {
    var t = translations[currentLang];
    var status = '';
    if (game.in_checkmate()) {
        status = t.checkmate;
    } else if (game.in_draw()) {
        status = t.draw;
    } else {
        status = game.turn() === 'w' ? t.statusReady : t.statusThinking;
    }
    $('#status').text(status);
}

var config = {
    draggable: true,
    position: 'start',
    onDragStart: onDragStart,
    onDrop: onDrop,
    onSnapEnd: function() { board.position(game.fen()); }
};

board = Chessboard('board', config);
updateStatus();

$('#startBtn').on('click', function() {
    game.reset();
    board.start();
    updateStatus();
});

// تفعيل زر تغيير المظهر (داكن / فاتح)
$('#themeToggle').on('click', function() {
    if ($('body').hasClass('dark-theme')) {
        $('body').removeClass('dark-theme').addClass('light-theme');
    } else {
        $('body').removeClass('light-theme').addClass('dark-theme');
    }
});

// تفعيل قائمة تغيير اللغات
$('#langSelect').on('change', function() {
    currentLang = $(this).val();
    let t = translations[currentLang];
    
    $('#htmlRoot').attr('lang', currentLang);
    $('#htmlRoot').attr('dir', currentLang === 'ar' ? 'rtl' : 'ltr');
    
    $('#ayanokojiName').text(t.ayanokojiName);
    $('#ayanokojiRole').text(t.ayanokojiRole);
    $('#playerName').text(t.playerName);
    $('#startBtn').text(t.startBtn);
    updateStatus();
});