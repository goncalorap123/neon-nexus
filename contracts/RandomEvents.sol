// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import {CadenceRandomConsumer} from "@onflow/flow-sol-utils/src/random/CadenceRandomConsumer.sol";

contract RandomEvents is CadenceRandomConsumer {
    struct EventRequest {
        address agent;
        uint8 eventType; // 0=gacha, 1=disaster, 2=trade_bonus, 3=loot
        uint256 timestamp;
    }

    mapping(uint256 => EventRequest) public pendingEvents;
    mapping(address => uint256) public activeRequest;

    event EventCommitted(address indexed agent, uint256 indexed requestId, uint8 eventType);
    event EventRevealed(address indexed agent, uint256 indexed requestId, uint8 eventType, uint256 outcome);

    function commitEvent(address agent, uint8 eventType) external returns (uint256) {
        require(activeRequest[agent] == 0, "Agent has pending event");

        uint256 requestId = _requestRandomness();
        pendingEvents[requestId] = EventRequest({
            agent: agent,
            eventType: eventType,
            timestamp: block.timestamp
        });
        activeRequest[agent] = requestId;

        emit EventCommitted(agent, requestId, eventType);
        return requestId;
    }

    function revealEvent(address agent) external returns (uint256 outcome) {
        uint256 requestId = activeRequest[agent];
        require(requestId != 0, "No pending event");

        EventRequest memory req = pendingEvents[requestId];
        delete activeRequest[agent];
        delete pendingEvents[requestId];

        if (req.eventType == 0) {
            outcome = _fulfillRandomInRange(requestId, 0, 99);
        } else if (req.eventType == 1) {
            outcome = _fulfillRandomInRange(requestId, 0, 9);
        } else if (req.eventType == 2) {
            outcome = _fulfillRandomInRange(requestId, 0, 49);
        } else {
            outcome = _fulfillRandomInRange(requestId, 0, 999);
        }

        emit EventRevealed(agent, requestId, req.eventType, outcome);
        return outcome;
    }
}
