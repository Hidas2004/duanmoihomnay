const express = require('express');
const cors = require('cors');
const Web3 = require('web3');
const path = require('path');
const fs = require('fs');

// --- CẤU HÌNH ---
const app = express();
app.use(cors());
app.use(express.json());

// 1. Kết nối Ganache
const web3 = new Web3('http://127.0.0.1:7545');

// 2. TỰ ĐỘNG ĐỌC FILE BUILD CỦA TRUFFLE
// (Code này thay thế cho địa chỉ và ABI viết cứng)

// Đường dẫn đến file JSON mà Truffle tạo ra
const contractBuildPath = path.resolve(
  __dirname,                  // Thư mục 'server-api' hiện tại
  '../VerifyX/build/contracts/ProductVerification.json' // Đi ngược ra, vào VerifyX/build...
);

if (!fs.existsSync(contractBuildPath)) {
  console.error("LỖI: Không tìm thấy file 'ProductVerification.json'.");
  console.error("Bạn đã chạy 'truffle migrate --reset' trong thư mục 'VerifyX' chưa?");
  process.exit(1);
}

// Đọc file JSON
const contractJson = JSON.parse(fs.readFileSync(contractBuildPath, 'utf8'));

// Tự động lấy địa chỉ (từ network 5777 - Ganache) và ABI
const contractAddress = contractJson.networks['5777'].address;
const contractABI = contractJson.abi;

console.log(`Da load hop dong: ProductVerification`);
console.log(`Dia chi hop dong: ${contractAddress}`);
// --------------------

const serverAccountPrivateKey = '0x6563dbb08092c9a4e97042a324200cd9ca4acf3e961a65591715f203a71393cf';

// 3. Khởi tạo tài khoản và hợp đồng
const serverAccount = web3.eth.accounts.privateKeyToAccount(serverAccountPrivateKey);
web3.eth.accounts.wallet.add(serverAccount);
const contract = new web3.eth.Contract(contractABI, contractAddress);
console.log(`May chu su dung vi: ${serverAccount.address}`);

// --- API CHO BRAND "ĐĂNG LÊN" ---
app.post('/api/batch/create', async (req, res) => {
  try {
    const { id, name, initialLocation } = req.body;

    const tx = await contract.methods.createBatch(id, name, initialLocation).send({
      from: serverAccount.address,
      gas: 500000,
    });

        console.log(`[createBatch] id=${id} name=${name} location=${initialLocation} tx=${tx.transactionHash}`);
    res.status(201).json({ success: true, txHash: tx.transactionHash });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// --- API CHO USER/SHIPPER "QUÉT" ---
app.post('/api/batch/scan', async (req, res) => {
  try {
    const { id, location, status } = req.body;

    const tx = await contract.methods.scanBatch(id, location, status).send({
      from: serverAccount.address,
      gas: 300000,
    });

        console.log(`[scanBatch] id=${id} location=${location} status=${status} tx=${tx.transactionHash}`);
    res.status(201).json({ success: true, txHash: tx.transactionHash });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// --- API CHO USER "TRUY XUẤT" ---
app.get('/api/history/:id', async (req, res) => {
  try {
        const batchId = req.params.id;
        console.log(`[getHistory] id=${batchId}`);

        // Kiểm tra batch tồn tại trước để tránh revert và lỗi decode
        const batch = await contract.methods.batches(batchId).call();
        if (!batch.isInitialized) {
            return res.status(404).json({
                error: `Batch ${batchId} khong ton tai tren blockchain`,
            });
        }

        const history = await contract.methods.getBatchHistory(batchId).call();

    const formattedHistory = history.map((record) => ({
      timestamp: new Date(Number(record.timestamp) * 1000).toISOString(),
      location: record.location,
      status: record.status,
      actor: record.actor,
    }));

    res.status(200).json(formattedHistory);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// Khởi động máy chủ
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`May chu API VerifyX (Node.js) dang chay tai http://localhost:${PORT}`);
});