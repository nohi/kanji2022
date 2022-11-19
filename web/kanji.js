// env
const kanji2022ABI = [{"inputs":[{"internalType":"string","name":"ans","type":"string"}],"name":"setCorrectAnswer","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"stateMutability":"nonpayable","type":"constructor"},{"inputs":[{"internalType":"string","name":"_kanji","type":"string"}],"name":"vote","outputs":[],"stateMutability":"nonpayable","type":"function"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"addr","type":"address"}],"name":"Voted","type":"event"},{"inputs":[],"name":"getMyVoteInfo","outputs":[{"components":[{"internalType":"string","name":"kanji","type":"string"},{"internalType":"uint256","name":"votedAt","type":"uint256"}],"internalType":"struct Kanji2022.PredictInfo","name":"","type":"tuple"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"getWinners","outputs":[{"internalType":"address[]","name":"","type":"address[]"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"string","name":"input","type":"string"}],"name":"strLen","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"pure","type":"function"},{"inputs":[],"name":"timeLimit","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"}];
const kanji2022Address = '0x9aB39D1D55BA13610C32729DAa5289c41D58A4aB';

// キーのprefixはWPのshortcode対策(networkList[xxx]の記述が勝手に変換される)
// https://chainlist.org/
const networkList = {
    1: 'Ethereum Mainnet',
    3: 'Ropsten (Test Network)',
    81: 'Shibuya (Test Network)'
};

// var
let web3js;
let kCont;
let isProcessing;

// onload
window.addEventListener('load', async function () {
    // web3がブラウザにインジェクトされているかチェック
    if (typeof web3 == 'undefined') {
        document.getElementById('no-metamask').style.display = 'block';
        return;
    }

    document.getElementById('metamask').style.display = 'block';

    initDom();
    await initContract();

    // do something
});

const initDom = () => {
    if (window.ethereum.isConnected() && window.ethereum.selectedAddress) {
        // hide connect button
        document.getElementById('connect-metamask').style.display = 'none';

        // dom update addr
        const elmWA = document.getElementById('wallet-address');
        elmWA.innerText = window.ethereum.selectedAddress;
        elmWA.href = 'https://shibuya.subscan.io/account/' + window.ethereum.selectedAddress;

        // dom update chainId
        domUpdateNetworkInfo(window.ethereum.chainId);

        // show
        document.querySelectorAll('.after-connect-metamask').forEach((el) => {
            el.style.display = 'block';
        });
    } else {
        // connect metamask button
        document.getElementById('connect-metamask').addEventListener('click', handlerConnectWallet);
    }

    // submit button
    document.getElementById('kanji-submit').addEventListener('click', handlerSubmit);
};

/**
 * create contract
 */
const initContract = async () => {
    // MetaMaskのプロバイダを使用
    web3js = new Web3(web3.currentProvider);

    // スマートコントラクト接続用インスタンスを作成
    kCont = new web3js.eth.Contract(kanji2022ABI, kanji2022Address);

    // 投票の締め切り日時を取得
    const timeLimit = await kCont.methods.timeLimit().call();
    document.getElementById('time-limit').innerText = t2dStr(timeLimit * 1000);

    // check metamask connected
    if (window.ethereum.isConnected() && window.ethereum.selectedAddress) {
        document.getElementById('your-predict').innerText = await getPredict(window.ethereum.selectedAddress);
    }

    // アカウント切り替え時のハンドラ登録
    // window.ethereum.on("accountsChanged", (account) => {
    // });

    // ネットワークの切り替え時のハンドラ登録
    window.ethereum.on("chainChanged", domUpdateNetworkInfo);
};

/**
 * get your predict
 * @return string
 */
const getPredict = async (fromAddr) => {
    const yourPredict = await kCont.methods.getMyVoteInfo().call({
        from: fromAddr,
        // gas: 1000000, // gas limit (optional)
        // gasPrice: 20000000 // gas price [wei/gas] (optional)
    });

    if (yourPredict.kanji.length > 0) {
        return yourPredict.kanji[0];
    } else {
        return "";
    }
}

/**
 * convert timestamp to date string
 */
const t2dStr = (ts) => {
    const ldt = new Date(ts);
    return ldt.getFullYear()
        + '/' + ('0' + (ldt.getMonth() + 1)).slice(-2)
        + '/' + ('0' + ldt.getDate()).slice(-2)
        + ' ' + ('0' + ldt.getHours()).slice(-2)
        + ':' + ('0' + ldt.getMinutes()).slice(-2)
        + ':' + ('0' + ldt.getSeconds()).slice(-2)
        + '(JST)';
};

/**
 * connect wallet (metamask)
 */
const handlerConnectWallet = async (e) => {
    const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
    document.getElementById('wallet-address').innerText = accounts[0];

    // [optional] get network id
    if (accounts.length > 0) {
        const networkIdRow = await window.ethereum.request({ method: 'eth_chainId' });
        domUpdateNetworkInfo(networkIdRow);
    }

    // get predict
    document.getElementById('your-predict').innerText = await getPredict(accounts[0]);

    // show
    document.querySelectorAll('.after-connect-metamask').forEach((el) => {
        el.style.display = 'block';
    });

    // hide connect button
    document.getElementById('connect-metamask').style.display = 'none';
};

/**
 * submit
 */
const handlerSubmit = async (e) => {
    if (typeof web3js == 'undefined') {
        return;
    }

    if (isProcessing) {
        return;
    }

    // validate form
    const inputKanji = document.getElementById('kanji-input').value;

    // 漢字チェック用の正規表現
    const regexp = /([\u{3005}\u{3007}\u{303b}\u{3400}-\u{9FFF}\u{F900}-\u{FAFF}\u{20000}-\u{2FFFF}][\u{E0100}-\u{E01EF}\u{FE00}-\u{FE02}]?)/mu;

    if (inputKanji.length < 1) {
        alert('入力されていません');
        return;
    } else if (inputKanji.length > 1) {
        alert('2文字以上入力されています。');
        return;
    } else if (!regexp.test(inputKanji)) {
        alert('漢字が入力されていません');
        return;
    }

    // get wallet address
    const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
    if (accounts.length <= 0) {
        console.log('no wallet account');
        return;
    }

    const btnSubmit = document.getElementById('kanji-submit');
    try {
        // disable submit button
        isProcessing = true;
        btnSubmit.style.backgroundColor = '#58625b';
        btnSubmit.classList.add('show');

        await kCont.methods.vote(inputKanji).send({
            from: accounts[0],
            value: 0, // トランザクションで送金するETH(トークン)量
            // gas: 1000000, // gas limit (optional)
            // gasPrice: 20000000 // gas price [wei/gas] (optional)
        });

        // show data
        document.getElementById('your-predict').innerText = await getPredict(accounts[0]);
    } finally {
        // enable submit button
        isProcessing = false;
        btnSubmit.style.backgroundColor = '#54ac6d';
        btnSubmit.classList.remove('show');
    }
};

const domUpdateNetworkInfo = (chainId) => {
    const chainIdInt = parseInt(chainId);

    let txt = chainIdInt;

    if (networkList[
        // wp shortcode対策の改行
        chainIdInt
    ] !== undefined) {
        txt = txt + ' ' + networkList[
            // wp shortcode対策の改行
            chainIdInt
        ];
    }

    document.getElementById('network-id').innerText = txt;
};