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

contract StreamingGetters is Stream {
    using SafeMath for uint256;

    function streamedFrom(Stream memory currentStream) internal pure returns (uint256) {
        return currentStream.timestampFrom;
    }

    function streamedUntil(Stream memory currentStream) internal pure returns (uint256) {
        return currentStream.timestampTo;
    }

    function streamDuration(Stream memory currentStream) internal pure returns (uint256) {
        return streamedUntil(currentStream).sub(streamedFrom(currentStream));
    }

    function streamTimeleft(Stream memory currentStream) internal view returns (uint256) {
        uint256 curTime = blockTimestamp();
        uint256 untilTime = streamedUntil(currentStream);

        if (curTime >= untilTime) {
            return 0;
        }

        return untilTime.sub(curTime);
    }

    function streamReserved(Stream memory currentStream) internal pure returns (uint256) {
        return currentStream.reserved;
    }

    function streamReleased(Stream memory currentStream) internal pure returns (uint256) {
        return currentStream.released;
    }

    function streamBoosted(Stream memory currentStream) internal pure returns (uint256) {
        return currentStream.boostCounter;
    }

    function releasableAmount(Stream memory currentStream) internal view returns (uint256) {
        uint256 curTime = blockTimestamp();
        uint256 untilTime = streamedUntil(currentStream);

        uint256 releasedAmount;
        if (untilTime == 0) {
            return 0;
        } else if (curTime >= untilTime) {
            releasedAmount = streamReserved(currentStream);
        } else {
            releasedAmount = streamReserved(currentStream)
                                .mul(curTime.sub(streamedFrom(currentStream)))
                                .div(streamDuration(currentStream));
        }

        return releasedAmount.sub(streamReleased(currentStream));
    }

    function unreleasedAmount(Stream memory currentStream) internal pure returns (uint256) {
        return streamReserved(currentStream).sub(streamReleased(currentStream));
    }

    function blockTimestamp() internal view returns (uint256) {
        return block.timestamp;
    }
}