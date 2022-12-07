// SPDX-License-Identifier: GPL-2.0
pragma solidity >=0.8.0 <0.9.0;

contract Kanji2022 {
    // contract owner
    address private _owner;

    // vote time limit
    uint256 public timeLimit;

    bytes4 private _correctAnswer;

    // voted kanji & vote time
    struct Predict {
        bytes4 kanji;
        uint256 votedAt;
    }

    // voted kanji & vote time
    struct PredictInfo {
        string kanji;
        uint256 votedAt;
    }

    // predicts map
    mapping(address => Predict) private _predicts;

    // predicts reverse map
    mapping(bytes4 => address[]) private _revPredicts;

    // event
    event Voted(address indexed addr);

    constructor() {
        // set vote time limit.
        timeLimit = 1670598000; // 2022-12-10 00:00:00

        // set contract owner
        _owner = msg.sender;
    }

    /*
     * [modifier] check vote time limit
     */
    modifier checkTimeLimit() {
        // XXX: the block.timestamp can be affected by a miner
        require(block.timestamp <= timeLimit, "Voting deadline has passed.");
        _;
    }

    /*
     * [modifier] check contract owner
     */
    modifier onlyOwner() {
        require(msg.sender == _owner, "Ownable: caller is not the owner.");
        _;
    }

    /*
     * get UTF string Length (high gas fee).
     * ref: https://ethereum.stackexchange.com/questions/13862/is-it-possible-to-check-string-variables-length-inside-the-contract
     */
    function utfStringLength(string memory str)
        internal
        pure
        returns (uint256 length)
    {
        uint256 i = 0;
        bytes memory string_rep = bytes(str);

        while (i < string_rep.length) {
            if (string_rep[i] >> 7 == 0) i += 1;
            else if (string_rep[i] >> 5 == bytes1(uint8(0x6))) i += 2;
            else if (string_rep[i] >> 4 == bytes1(uint8(0xE))) i += 3;
            else if (string_rep[i] >> 3 == bytes1(uint8(0x1E))) i += 4;
            else i += 1; //For safety

            length++;
        }

        return length;
    }

    /*
     * vote
     */
    function vote(string memory _kanji) public checkTimeLimit {
        // check kanji length
        require(utfStringLength(_kanji) == 1);

        // TODO: check is kanji

        // string -> bytes4
        bytes4 kanji = bytes4(bytes(_kanji));

        // store data
        _predicts[msg.sender] = Predict({
            kanji: kanji,
            votedAt: block.timestamp
        });

        // remove old rev predict from  _revPredicts[kanji]
        for (uint256 i = 0; i < _revPredicts[kanji].length; i++) {
            // if voter has old predict
            if (_revPredicts[kanji][i] == msg.sender) {
                // remove from _revPredicts
                uint256 lastIdx = _revPredicts[kanji].length - 1;
                _revPredicts[kanji][i] = _revPredicts[kanji][lastIdx];
                _revPredicts[kanji].pop();
            }
        }

        // store rev predict
        _revPredicts[kanji].push(msg.sender);

        // voted event
        emit Voted(msg.sender);
    }

    /*
     * get voted info
     */
    function getMyVoteInfo() public view returns (PredictInfo memory) {
        return
            PredictInfo({
                kanji: string(abi.encodePacked(_predicts[msg.sender].kanji)),
                votedAt: _predicts[msg.sender].votedAt
            });
    }

    function getCorrectAnswer() public view returns (string memory) {
        return string(abi.encodePacked(_correctAnswer));
    }

    /*
     * set answer
     */
    function setCorrectAnswer(string memory ans) public onlyOwner {
        _correctAnswer = bytes4(bytes(ans));
    }

    /*
     * get winner (has correct answer)
     */
    function getWinners() public view returns (address[] memory) {
        return _revPredicts[_correctAnswer];
    }

    /*
     * set time limit
     */
    function setTimeLimit(uint256 tl) public onlyOwner {
        timeLimit = tl;
    }

    // ---- for debug ----
    function strLen(string memory input) public pure returns (uint256) {
        return utfStringLength(input);
    }
}
