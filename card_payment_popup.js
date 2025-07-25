/** @odoo-module */
import {
  useState,
  onMounted,
  onWillUnmount,
  Component,
  onWillStart,
} from "@odoo/owl";
import { Dialog } from "@web/core/dialog/dialog";
import { useService } from "@web/core/utils/hooks";
import { _t } from "@web/core/l10n/translation";
export class CardPaymentPopup extends Component {
  static template = "pos_card_payment.CardPaymentPopup";
  static components = { Dialog };

  setup() {
    super.setup();
    this.webSocket = useService("webSocket");
    this.orm = useService("orm");
    this.notification = useService("notification");
    // State management for card scanning
    this.state = useState({
      scanningState: "waiting", // 'waiting', 'scanning', 'success'
      errorMessage: "",
    });

    // WebSocket connection
    this.scanTimeout = null;
    this.processingTimeout = null;

    // Card detection simulation
    this.cardDetectionTimeout = null;

    onMounted(() => {
      // this.startCardDetection();
      this.startCardScanning();
    });

    onWillStart(() => {
      this.webSocket.connect();
      this.webSocket.onMessage(this.handleWebSocketMessage.bind(this));
    });

    onWillUnmount(() => {
      this.webSocket.disconnect;
      this.cleanup();
    });
  }

  startCardScanning() {
    if (this.webSocket && !this.webSocket.isDisconnect) {
      // Đặt timeout để quét thẻ
      this.scanTimeout = setInterval(() => {
        this.webSocket.send("quet the tid");
      }, 3000);
    }
  }

  async handleWebSocketMessage(event) {
    try {
      if (event.data == "GetConnect" || event.data=="quet the tid" || event.data=="quet the") return;
      if (event.data) {
        const data = JSON.parse(event.data);
        console.log("Received WebSocket message:", data);
        // Kiểm tra format từ server C#
        if (data.code === 200 && data.tid) {
          // Dừng timeout quét thẻ
          this.clearScanTimeout();

          // Chuyển sang trạng thái processing
          this.state.scanningState = "scanning";

          // Xử lý thanh toán với TID
          await this.processPayment(data.tid);
        } else {
          // this.state.scanningState = "error";
          // this.state.errorMessage = data.message || "Lỗi không xác định";
        }
      }
    } catch (error) {
      console.error("Error parsing WebSocket message:", error);
      this.state.scanningState = "error";
      this.state.errorMessage = "Lỗi xử lý dữ liệu từ server";
    }
  }

  async processPayment(tid) {
    try {
      // Tìm kiếm partner theo card_tid
      const partners = await this.orm.searchRead(
        "res.partner",
        [["card_tid", "=", tid]],
        ["id", "name", "money", "currency_id"]
      );

      if (partners.length === 0) {
        this.state.scanningState = "error";
        this.state.errorMessage = "Không tìm thấy thẻ trong hệ thống";
        return;
      }

      const partner = partners[0];
      console.log(partner)
      const paymentAmount = this.props.amountTotalInt;

      // Kiểm tra số dư
      if (partner.money < paymentAmount) {
        this.state.scanningState = "error";
        this.state.errorMessage = "Số dư không đủ để thanh toán";
        this.notification.add(
          _t("Số dư không đủ. Số dư hiện tại: %s", partner.money),
          { type: "warning" }
        );
        return;
      }

      // Trừ tiền
      const newBalance = partner.money - paymentAmount;
      await this.orm.write("res.partner", [partner.id], {
        money: newBalance,
      });

      // Thanh toán thành công
      this.state.scanningState = "success";
      this.cardData = {
        success: true,
        partner_id: partner.id,
        partner_name: partner.name,
        tid: tid,
        amount: paymentAmount,
        old_balance: partner.money,
        new_balance: newBalance,
      };

      // Tự động đóng popup sau 2 giây
      setTimeout(() => {
        this.confirm();
      }, 2000);
    } catch (error) {
      console.error("Error processing payment:", error);
      this.state.scanningState = "error";
      this.state.errorMessage = "Lỗi xử lý thanh toán";
    }
  }

  clearScanTimeout() {
    if (this.scanTimeout) {
      clearTimeout(this.scanTimeout);
      this.scanTimeout = null;
    }
  }
  startCardDetection() {
    // Simulate card detection after 3-5 seconds for demo
    this.cardDetectionTimeout = setTimeout(() => {
      this.onCardDetected();
    }, Math.random() * 2000 + 3000);
  }

  onCardDetected() {
    // Change state to scanning
    this.state.scanningState = "scanning";

    // Simulate processing time
    this.processingTimeout = setTimeout(() => {
      this.onPaymentSuccess();
    }, 2000);
  }

  onPaymentSuccess() {
    // Change state to success
    this.state.scanningState = "success";

    // Auto-confirm after showing success for 2 seconds
    setTimeout(() => {
      this.confirm();
    }, 2000);
  }

  // Method to manually trigger card detection (for testing)
  simulateCardTap() {
    if (this.state.scanningState === "waiting") {
      this.cleanup();
      this.onCardDetected();
    }
  }
  confirm() {
    this.cleanup();
    // Gọi callback với kết quả payment
    if (this.props.onPaymentResult) {
      this.props.onPaymentResult(this.cardData || { success: true });
    }
    this.props.close();
  }

  cleanup() {
    if (this.cardDetectionTimeout) {
      clearTimeout(this.cardDetectionTimeout);
      this.cardDetectionTimeout = null;
    }
    if (this.processingTimeout) {
      clearTimeout(this.processingTimeout);
      this.processingTimeout = null;
    }

    // Clear timeouts
    this.clearScanTimeout();
    if (this.processingTimeout) {
      clearTimeout(this.processingTimeout);
      this.processingTimeout = null;
    }
  }

  setReceivedCardPaymentData(cardData) {
    this.cardData = cardData;
    // Trigger payment success when receiving data
    this.onPaymentSuccess();
  }

  cancel() {
    // Gọi callback với null để báo hiệu cancel
    if (this.props.onPaymentResult) {
      this.props.onPaymentResult(null);
    }
    this.cleanup();
    this.props.close();
  }
  async getPayload() {
    return this.cardData;
  }

  // Method để retry khi có lỗi
  retryCardScanning() {
    this.state.scanningState = 'waiting';
    this.state.errorMessage = '';
    
    // Clear các timer cũ
    this.clearScanTimeout();
    
    // Bắt đầu quét lại
    if (this.webSocket && !this.webSocket.isDisconnect) {
      this.startCardScanning();
    } else {
      // Nếu WebSocket bị đóng, tạo lại connection
      this.webSocket.connect();
      this.webSocket.onMessage(this.handleWebSocketMessage.bind(this));
    }
  }
}
