// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract NeonNexus is Ownable {
    IERC20 public depositToken;

    struct Agent {
        address wallet;
        uint256 deposit;
        uint256 yieldEarned;
        uint256 lastHarvest;
        uint8 strategyType;
        bool active;
    }

    mapping(address => Agent) public agents;
    mapping(address => address) public playerAgent;

    uint256 public totalDeposits;

    event AgentCreated(address indexed player, address indexed agentWallet);
    event Deposited(address indexed agentWallet, uint256 amount);
    event Withdrawn(address indexed agentWallet, uint256 amount);
    event YieldHarvested(address indexed agentWallet, uint256 amount);
    event StrategyUpdated(address indexed agentWallet, uint8 strategyType);
    event AgentEliminated(address indexed agentWallet);
    event YieldTransferred(address indexed from, address indexed to, uint256 amount);

    constructor(address _depositToken) Ownable(msg.sender) {
        depositToken = IERC20(_depositToken);
    }

    function registerAgent(address player, address agentWallet) external onlyOwner {
        require(!agents[agentWallet].active, "Agent already exists");
        agents[agentWallet] = Agent({
            wallet: agentWallet,
            deposit: 0,
            yieldEarned: 0,
            lastHarvest: block.timestamp,
            strategyType: 1,
            active: true
        });
        playerAgent[player] = agentWallet;
        emit AgentCreated(player, agentWallet);
    }

    function deposit(address agentWallet, uint256 amount) external {
        require(agents[agentWallet].active, "Agent not active");
        require(depositToken.transferFrom(msg.sender, address(this), amount), "Transfer failed");
        agents[agentWallet].deposit += amount;
        totalDeposits += amount;
        emit Deposited(agentWallet, amount);
    }

    function withdraw(address agentWallet, uint256 amount) external {
        Agent storage agent = agents[agentWallet];
        require(agent.active, "Agent not active");
        require(agent.deposit >= amount, "Insufficient deposit");
        agent.deposit -= amount;
        totalDeposits -= amount;
        require(depositToken.transfer(msg.sender, amount), "Transfer failed");
        emit Withdrawn(agentWallet, amount);
    }

    function distributeYield(address agentWallet, uint256 yieldAmount) external onlyOwner {
        require(agents[agentWallet].active, "Agent not active");
        agents[agentWallet].yieldEarned += yieldAmount;
        agents[agentWallet].lastHarvest = block.timestamp;
        emit YieldHarvested(agentWallet, yieldAmount);
    }

    function setStrategy(address agentWallet, uint8 strategyType) external {
        require(agents[agentWallet].active, "Agent not active");
        require(strategyType <= 2, "Invalid strategy");
        agents[agentWallet].strategyType = strategyType;
        emit StrategyUpdated(agentWallet, strategyType);
    }

    function deactivateAgent(address agentWallet) external onlyOwner {
        require(agents[agentWallet].active, "Agent not active");
        agents[agentWallet].active = false;
        emit AgentEliminated(agentWallet);
    }

    function transferYield(address from, address to, uint256 amount) external onlyOwner {
        require(agents[from].yieldEarned >= amount, "Insufficient yield");
        require(agents[to].active, "Recipient not active");
        agents[from].yieldEarned -= amount;
        agents[to].yieldEarned += amount;
        emit YieldTransferred(from, to, amount);
    }

    function getAgent(address agentWallet) external view returns (Agent memory) {
        return agents[agentWallet];
    }
}
