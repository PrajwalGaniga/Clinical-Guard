// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/// @title ClinicalTrialIntegrity
/// @notice A smart contract for anchoring ML-validated clinical trial records
///         on the Polygon Amoy private blockchain.
/// @dev    Deployed alongside the ClinicalGuard SaaS platform.
///         Sahyadri College of Engineering & Management, Mangaluru — 2025-26
contract ClinicalTrialIntegrity {

    // ── Data Structures ──────────────────────────────────────────────

    struct TrialRecord {
        string  trialId;
        string  siteId;
        bytes32 dataHash;
        uint8   integrityLabel;   // 1 = Authentic, 0 = Manipulated
        uint256 confidenceAuth;   // scaled x100 (e.g. 9977 = 99.77%)
        string  riskLevel;        // "LOW" | "MEDIUM" | "HIGH"
        string  mlModel;          // e.g. "DT"
        uint256 timestamp;
        address validatorNode;
        bool    committed;
    }

    struct NodeTrust {
        uint256 trustScore;           // 0–10000 (10000 = 100%)
        uint256 totalValidations;
        uint256 correctValidations;
    }

    // ── State Variables ───────────────────────────────────────────────

    mapping(bytes32 => TrialRecord) public records;
    mapping(address => NodeTrust)   public nodeTrust;
    mapping(string  => bool)        public authorizedSites;

    address public owner;
    uint256 public minConfidence = 8500;  // 85.00%

    // ── Events ────────────────────────────────────────────────────────

    event TransactionCommitted(
        bytes32 indexed txHash,
        string  trialId,
        string  siteId,
        uint256 confidence,
        uint256 timestamp
    );

    event ManipulationDetected(
        bytes32 indexed txHash,
        string  trialId,
        string  siteId,
        string  riskLevel,
        uint256 confidence
    );

    event FlaggedForReview(
        bytes32 indexed txHash,
        string  siteId,
        string  riskLevel
    );

    event TrustScoreUpdated(
        address indexed node,
        uint256 oldScore,
        uint256 newScore
    );

    // ── Modifiers ─────────────────────────────────────────────────────

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier trustedNode() {
        require(
            nodeTrust[msg.sender].trustScore >= 6000,
            "Node trust score too low (< 60%)"
        );
        _;
    }

    modifier authorizedSite(string memory siteId) {
        require(authorizedSites[siteId], "Site not authorized");
        _;
    }

    // ── Constructor ───────────────────────────────────────────────────

    constructor() {
        owner = msg.sender;
        // Bootstrap: owner=trusted node at deployment
        nodeTrust[msg.sender] = NodeTrust(10000, 0, 0);
    }

    // ── Core Validation Function ──────────────────────────────────────

    /// @notice Validate and commit a clinical trial record to the ledger.
    /// @param trialId    NCT identifier (e.g. "NCT04414150")
    /// @param siteId     Clinical site identifier (e.g. "SITE_001")
    /// @param dataHash   SHA-256 hash of the off-chain record (bytes32)
    /// @param label      ML integrity label: 1=Authentic, 0=Manipulated
    /// @param confidence ML confidence (authentic) scaled x100
    /// @param riskLevel  "LOW" | "MEDIUM" | "HIGH"
    /// @param mlModel    Model identifier (e.g. "DT")
    function validateAndCommit(
        string  memory trialId,
        string  memory siteId,
        bytes32        dataHash,
        uint8          label,
        uint256        confidence,
        string  memory riskLevel,
        string  memory mlModel
    )
        external
        trustedNode
        authorizedSite(siteId)
        returns (bytes32 txHash)
    {
        txHash = keccak256(abi.encodePacked(
            trialId, siteId, dataHash,
            block.timestamp, msg.sender
        ));

        bool shouldCommit = (label == 1 && confidence >= minConfidence);

        records[txHash] = TrialRecord({
            trialId:        trialId,
            siteId:         siteId,
            dataHash:       dataHash,
            integrityLabel: label,
            confidenceAuth: confidence,
            riskLevel:      riskLevel,
            mlModel:        mlModel,
            timestamp:      block.timestamp,
            validatorNode:  msg.sender,
            committed:      shouldCommit
        });

        if (shouldCommit) {
            _updateTrust(msg.sender, true);
            emit TransactionCommitted(txHash, trialId, siteId, confidence, block.timestamp);
        } else if (label == 0) {
            _updateTrust(msg.sender, true);
            emit ManipulationDetected(txHash, trialId, siteId, riskLevel, confidence);
        } else {
            emit FlaggedForReview(txHash, siteId, riskLevel);
        }

        return txHash;
    }

    // ── Trust Score Update (Internal) ─────────────────────────────────

    function _updateTrust(address node, bool correct) internal {
        NodeTrust storage nt = nodeTrust[node];
        uint256 old = nt.trustScore;
        nt.totalValidations++;
        if (correct) nt.correctValidations++;
        nt.trustScore = (nt.correctValidations * 10000) / nt.totalValidations;
        emit TrustScoreUpdated(node, old, nt.trustScore);
    }

    // ── Admin Functions ───────────────────────────────────────────────

    function authorizeSite(string memory siteId) external onlyOwner {
        authorizedSites[siteId] = true;
    }

    function revokeSite(string memory siteId) external onlyOwner {
        authorizedSites[siteId] = false;
    }

    function registerNode(address node) external onlyOwner {
        nodeTrust[node] = NodeTrust(10000, 0, 0);
    }

    function setMinConfidence(uint256 val) external onlyOwner {
        minConfidence = val;
    }

    // ── View Functions ────────────────────────────────────────────────

    function getRecord(bytes32 txHash)
        external view returns (TrialRecord memory)
    {
        return records[txHash];
    }

    function getTrustScore(address node)
        external view returns (uint256)
    {
        return nodeTrust[node].trustScore;
    }
}
