/*
    Copyright 2021 Universal Dollar Devs, based on the works of the Empty Set Squad

    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.
*/

pragma solidity ^0.5.17;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "./Stream.sol";
import "./StreamingGetters.sol";

contract StreamingSetters is Stream, StreamingGetters {
    using SafeMath for uint256;

    function setStream(Stream storage currentStream, uint256 amount, uint256 streamPeriod) internal {
        currentStream.reserved = amount;
        currentStream.released = 0;
        currentStream.timestampFrom = uint64(blockTimestamp());
        currentStream.timestampTo = uint64(blockTimestamp().add(streamPeriod)); // safe
    }

    function resetStream(Stream storage currentStream) internal {
        currentStream.reserved = 0;
        currentStream.released = 0;
        currentStream.timestampFrom = 0;
        currentStream.timestampTo = 0;
        currentStream.boostCounter = 0;
    }

    function incrementBoostCounter(Stream storage currentStream) internal {        
        currentStream.boostCounter++; // safe
    }

    function incrementReleased(Stream storage currentStream, uint256 amount) internal {
        currentStream.released = currentStream.released.add(amount);
    }
}