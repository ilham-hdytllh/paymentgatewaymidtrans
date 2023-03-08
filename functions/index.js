const functions = require("firebase-functions");
const admin = require("firebase-admin");
const express = require("express");
const cors = require("cors");

admin.initializeApp();
const db = admin.firestore();
const app = express();
app.use(express.json());
app.use(cors());

const midtransClient = require("midtrans-client");
const { route } = require(".");
const { response } = require("express");

// Create Snap instance
let snap = new midtransClient.Snap({
  isProduction: false,
  serverKey: "SB-Mid-server-D4yNStPns_ujcpCblpHKtuE7",
  clientKey: "SB-Mid-client-ECUQLfo97FAHgMb7",
});
// Create Core API instance
let coreApi = new midtransClient.CoreApi({
  isProduction: false,
  serverKey: "SB-Mid-server-D4yNStPns_ujcpCblpHKtuE7",
  clientKey: "SB-Mid-client-ECUQLfo97FAHgMb7",
});

app.post("/order/snap", (req, res) => {
  let order_id = req.body.transaction_details.order_id;
  let gross_amount = req.body.transaction_details.gross_amount;
  let parameter = req.body;
  let waiting_number = req.body.waiting_number;
  let table_number = req.body.table_number;
  let note = req.body.note;
  let number_of_people = req.body.number_of_people;
  let order_type = req.body.order_type;
  let pesanan = req.body.item_details;
  let order_status = req.body.order_status;
  let customer_name = req.body.customer_details.first_name;
  let transaction_time = req.body.transaction_time;
  let transaction_id = req.body.transaction_id;
  let payment_type = req.body.payment_type;
  snap
    .createTransaction(parameter)
    .then(async (transaction) => {
      await db
        .collection("orders")
        .doc(order_id)
        .set({
          note: note,
          table_number: table_number,
          waiting_number: waiting_number,
          customer_name: customer_name,
          number_of_people: number_of_people,
          order_type: order_type,
          pesanan: pesanan,
          order_status: order_status,
          order_id: order_id,
          gross_amount: gross_amount,
          transaction_time: transaction_time,
          transactionRedirectUrl: transaction.redirect_url,
          transaction_status: "belum dibayar",
          transaction_id: transaction_id,
          payment_type: payment_type,
        })
        .catch((e) => {
          res
            .status(400)
            .send("Data Gagal Dimasukkan Kedalam Database" + e.message);
        });
      let transactionRedirectUrl = transaction.redirect_url;
      res.status(200).json({
        redirectURL: transactionRedirectUrl,
        note: note,
        table_number: table_number,
        waiting_number: waiting_number,
        customer_name: customer_name,
        number_of_people: number_of_people,
        order_type: order_type,
        pesanan: pesanan,
        order_status: order_status,
        order_id: order_id,
        gross_amount: gross_amount,
        payment_type: payment_type,
        transaction_time: transaction_time,
        transaction_id: transaction_id,
        transaction_status: "pending",
      });
    })
    .catch((e) => {
      res.status(400).json({
        pesan: "Gagal Melakukan Charge: " + e.message,
      });
    });
});

app.post("/order/snap/aftereat", (req, res) => {
  let order_id = req.body.transaction_details.order_id;
  let gross_amount = req.body.transaction_details.gross_amount;
  let parameter = req.body;
  snap
    .createTransaction(parameter)
    .then(async (transaction) => {
      await db
        .collection("orders")
        .doc(order_id)
        .update({
          transactionRedirectUrl: transaction.redirect_url,
        })
        .catch((e) => {
          res
            .status(400)
            .send("Data Gagal Dimasukkan Kedalam Database" + e.message);
        });
      let transactionRedirectUrl = transaction.redirect_url;
      res.status(200).json({
        redirectURL: transactionRedirectUrl,
        order_id: order_id,
        gross_amount: gross_amount,
      });
    })
    .catch((e) => {
      res.status(400).json({
        pesan: "Gagal Melakukan Charge: " + e.message,
      });
    });
});

app.get("/order", async (req, res) => {
  const snapshot = await db
    .collection("orders")
    .get()
    .catch((e) => {
      res.status(400).send("Gagal Mendapatkan Data Dari Database");
    });
  const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  res.status(200).send(data);
});

app.post("/order/charge/btf", (req, res) => {
  let waiting_number = req.body.waiting_number;
  let table_number = req.body.table_number;
  let note = req.body.note;
  let number_of_people = req.body.number_of_people;
  let order_type = req.body.order_type;
  let pesanan = req.body.pesanan;
  let order_status = req.body.order_status;
  let customer_name = req.body.customer_details.first_name;
  coreApi
    .charge(req.body)
    .then(async (chargeResponse) => {
      let transaction_id = chargeResponse.transaction_id;
      let order_id = chargeResponse.order_id;
      let gross_amount = chargeResponse.gross_amount;
      let payment_type = chargeResponse.payment_type;
      let transaction_time = chargeResponse.transaction_time;
      let transaction_status = chargeResponse.transaction_status;
      let va_numbers = chargeResponse.va_numbers;
      let bill_key = chargeResponse.bill_key;
      let permata_va_number = chargeResponse.permata_va_number;
      function validasiVA() {
        if (bill_key == null && permata_va_number == null) {
          return va_numbers;
        } else if (bill_key == null && va_numbers == null) {
          return permata_va_number;
        } else {
          return bill_key;
        }
      }
      let response_midtrans_backup = JSON.stringify(chargeResponse);
      await db.collection("orders").doc(order_id).set({
        note: note,
        number_of_people: number_of_people,
        order_type: order_type,
        pesanan: pesanan,
        order_status: order_status,
        transaction_id: transaction_id,
        order_id: order_id,
        gross_amount: gross_amount,
        payment_type: payment_type,
        transaction_time: transaction_time,
        transaction_status: transaction_status,
        va_numbers: validasiVA(),
        waiting_number: waiting_number,
        table_number: table_number,
        customer_name: customer_name,
        response_midtrans_backup: response_midtrans_backup,
      });
      res
        .status(200)
        .send({
          chargeResponse,
        })
        .catch((e) => {
          res.status(400).send("Gagal Melakukan Charge: " + e.message);
        });
    })
    .catch((e) => {
      res.send(500).json({
        status: false,
        pesan: "Gagal Bayar: " + e.message,
      });
    });
});

app.post("/order/charge/ewt", async (req, res) => {
  let waiting_number = req.body.waiting_number;
  let table_number = req.body.table_number;
  let note = req.body.note;
  let number_of_people = req.body.number_of_people;
  let order_type = req.body.order_type;
  let pesanan = req.body.pesanan;
  let order_status = req.body.order_status;
  let customer_name = req.body.customer_details.first_name;
  coreApi
    .charge(req.body)
    .then(async (chargeResponse) => {
      let response_midtrans_backup = JSON.stringify(chargeResponse);
      await db.collection("orders").doc(order_id).set({
        response_midtrans_backup: response_midtrans_backup,
      });
      res
        .status(200)
        .send({
          chargeResponse,
        })
        .catch((e) => {
          res.status(400).send("Gagal Melakukan Charge: " + e.message);
        });
    })
    .catch((e) => {
      res.send(500).json({
        status: false,
        pesan: "Gagal Bayar: " + e.message,
      });
    });
});

// app.post("/order/charge/ccd", async (req, res) => {
// let cardData = {
//   card_number: 4811111111111114,
//   card_exp_month: 12,
//   card_exp_year: 2025,
//   card_cvv: 123,
// };

// // callback functions
// let options = {
//   onSuccess: function (response) {
//     console.log("Success to get card token_id, response:", response);
//     let token_id = response.token_id;
//     // res.send("This is the card token_id:", token_id);
//     console.log("This is the card token_id:", token_id);
//   },
//   onFailure: function (response) {
//     console.log("Fail to get card token_id, response:", response);
//     // res.send("Failure 3D Secure");
//   },
// };

// trigger `getCardToken` function
//   MidtransNew3ds.getCardToken(req.body).then(async (respon) => {
//     let response = JSON.stringify(respon);
//   });

//   res
//     .send({
//       msg: respon,
//     })
//     .catch((err) => {
//       res.json({
//         pesan: "Gagal respon: " + err.message,
//       });
//     });
// });

app.post("/order/notifikasi", async (req, res) => {
  snap.transaction
    .notification(req.body)
    .then(async (statusResponse) => {
      let order_id = statusResponse.order_id;
      let transaction_status = statusResponse.transaction_status;
      let payment_type = statusResponse.payment_type;
      let response_midtrans_notifications = JSON.stringify(statusResponse);
      function statusPembayaran() {
        if (
          transaction_status == "settlement" ||
          transaction_status == "success" ||
          transaction_status == "capture"
        ) {
          return "telah dibayar";
        } else {
          return "belum dibayar";
        }
      }
      if (
        transaction_status == "settlement" ||
        transaction_status == "success" ||
        transaction_status == "capture"
      ) {
        await db.collection("orders").doc(order_id).update({
          response_midtrans_notifications: response_midtrans_notifications,
          payment_type: payment_type,
          transaction_status: statusPembayaran(),
        });
      } else {
        null;
      }
      res
        .status(200)
        .send({
          msg: "Berhasil Notifikasi",
        })
        .catch((err) => {
          res.status(400).json({
            pesan: "Gagal Notifikasi: " + err.message,
          });
        });
    })
    .catch((e) => {
      res.status(500).json({
        status: false,
        pesan: "Gagal Notifikasi Dari Midtrans: " + e.message,
      });
    });
});

app.use("/", (req, res) => {
  res.status(404).sendFile("./404.html", { root: __dirname });
});

exports.functions = functions.https.onRequest(app);
