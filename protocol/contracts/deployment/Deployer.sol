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

import "../external/Decimal.sol";
import "../token/Dollar.sol";
import "../oracle/Oracle.sol";
import "../oracle/Pool.sol";
import "../dao/Upgradeable.sol";
import "../dao/Permission.sol";
import "../dao/Root.sol";


contract DollarFactory {
    function getCreationBytecode() private pure returns (bytes memory) {
        bytes memory bytecode = type(Dollar).creationCode;
        return abi.encodePacked(bytecode);
    }

    function deployDollar(bytes32 salt) internal returns (address) {
        bytes memory bytecode = getCreationBytecode();
        address addr;
        assembly {
            addr := create2(0, add(bytecode, 0x20), mload(bytecode), salt)

            if iszero(extcodesize(addr)) {
                revert(0, 0)
            }
        }

        return addr;
    }
}

contract Deployer1 is State, Permission, Upgradeable, DollarFactory {
    function initialize() initializer public {
        bytes32 salt = 0x0000000000000000000000000000000000000000000000000000000000b9c7be;
        _state.provider.dollar = Dollar(deployDollar(salt));
    }

    function implement(address implementation) external {
        upgradeTo(implementation);
    }
}

contract Deployer2 is State, Permission, Upgradeable {
    function initialize() initializer public {
        _state.provider.oracle = new Oracle(address(dollar()));
        oracle().setup();
    }

    function implement(address implementation) external {
        upgradeTo(implementation);
    }
}

contract Deployer3 is State, Permission, Upgradeable {
    event PoolDeployed(address proxy, address implementation);

    function initialize() initializer public {
        address poolImplementation = address(new Pool());
        address pool = address(new Root(poolImplementation));
        Pool(pool).initialize(address(this), address(dollar()), address(oracle().pair()));

        _state.provider.pool = pool;

        emit PoolDeployed(pool, poolImplementation);
    }

    function implement(address implementation) external {
        upgradeTo(implementation);
    }
}