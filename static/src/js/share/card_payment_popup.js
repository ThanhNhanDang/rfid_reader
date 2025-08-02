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
    this.bus = useService("bus_service");

    // State management for card scanning
    this.state = useState({
      scanningState: "waiting", // 'waiting', 'scanning', 'success', 'error'
      errorMessage: "",
      operationType: this.props.type || "read", // 'read', 'write', 'payment', 'balance'
    });

    // WebSocket và timeout management
    this.scanTimeout = null;
    this.processingTimeout = null;
    this.cardDetectionTimeout = null;

    // Flag để theo dõi trạng thái operation
    this.isOperationActive = false;
    this.isComponentMounted = true;
    this.lastOperationTime = 0; // Thêm để debounce

    onWillStart(async () => {
      // Đảm bảo disconnect trước khi connect mới
      this.webSocket.disconnect();

      // Đăng ký callbacks trước khi connect
      this.webSocket.onMessage(this.handleWebSocketMessage.bind(this));
      this.webSocket.onOpen(this.handleWebSocketOpen.bind(this));

      // Connect
      this.webSocket.connect();
    });

    onWillUnmount(() => {
      this.isComponentMounted = false;
      this.cleanup();
      // Disconnect và clear tất cả callbacks
      this.webSocket.disconnect();
    });
  }

  handleWebSocketOpen() {
    // Chỉ start operation nếu component vẫn mounted và chưa có operation nào đang chạy
    if (this.isComponentMounted && !this.isOperationActive) {
      this.startCardOperation();
    }
  }

  startCardOperation() {
    // Ngăn chặn việc start multiple operations
    if (this.isOperationActive) {
      console.log("Operation already active, skipping...");
      return;
    }

    if (this.webSocket && !this.webSocket.isDisconnect) {
      this.isOperationActive = true;

      // Gửi lệnh đầu tiên
      this.sendOperationCommand();

      // Clear timeout cũ nếu có
      this.clearScanTimeout();

      // Tạo interval mới
      this.scanTimeout = setInterval(() => {
        // Kiểm tra component vẫn mounted và WebSocket vẫn connected
        if (!this.isComponentMounted || this.webSocket.isDisconnect) {
          this.clearScanTimeout();
          this.isOperationActive = false;
          return;
        }

        // Kiểm tra trạng thái scanning để tránh gửi lệnh khi đang xử lý
        if (
          this.state.scanningState === "scanning" ||
          this.state.scanningState === "success"
        ) {
          return;
        }

        this.sendOperationCommand();
      }, 1000);
    }
  }

  sendOperationCommand() {
    if (!this.webSocket || this.webSocket.isDisconnect) {
      return;
    }

    if (this.state.operationType === "write") {
      // Ghi dữ liệu lên thẻ
      this.webSocket.send("ghi epc|" + this.props.data + "x");
    } else if (this.state.operationType === "balance") {
      // Đọc số dư từ thẻ
      this.webSocket.send("doc so du");
    } else if (this.state.operationType === "payment") {
      // Thanh toán
      this.webSocket.send("thanh_toan|" + this.props.amountTotalInt + "x");
    } else if (this.state.operationType === "read") {
      // Đọc TID từ thẻ
      this.webSocket.send("quet the tid");
    }
  }

  async handleWebSocketMessage(event) {
    try {
      // Bỏ qua nếu component đã unmount
      if (!this.isComponentMounted) {
        return;
      }

      if (
        event.data[0] == "g" ||
        event.data[0] == "q" ||
        event.data[0] == "G" ||
        event.data[0] == "t" ||
        event.data[0] == "d"
      )
        return;

      if (event.data) {
        const data = JSON.parse(event.data);
        console.log("Received WebSocket message:", data);
        if (data.code === 406) {
          this.state.scanningState = "error";
          this.state.errorMessage = "Không tìm thấy thẻ trong hệ thống";
          return;
        } else if (data.code === 407) {
          this.state.scanningState = "error";
          this.state.errorMessage = "Số dư không đủ để thanh toán";
          this.notification.add(
            _t("Số dư không đủ. Số dư hiện tại: %s", data.message),
            { type: "warning" }
          );
          return;
        } else if (
          data.code === 200 ||
          data.code === 201 ||
          data.code === 204 ||
          data === 205
        ) {
          // Dừng scanning khi nhận được response thành công
          this.clearScanTimeout();
          this.isOperationActive = false;
          this.state.scanningState = "scanning";

          // Disconnect WebSocket để tránh nhận thêm messages
          this.webSocket.disconnect();

          if (this.state.operationType === "write") {
            await this.processWriteOperation(data);
          } else if (this.state.operationType === "balance") {
            await this.processBalanceRead(data);
          } else if (this.state.operationType === "payment" && data.tid) {
            await this.processPayment(data.tid);
          } else if (data.tid) {
            await this.processCardRead(data.tid);
          }
        } else if (data.code === 500 || data.error) {
          this.clearScanTimeout();
          this.isOperationActive = false;
          this.state.scanningState = "error";
          this.state.errorMessage = data.message || "Lỗi không xác định";
        }
      }
    } catch (error) {
      console.error("Error parsing WebSocket message:", error);
      this.clearScanTimeout();
      this.isOperationActive = false;
      this.state.scanningState = "error";
      this.state.errorMessage = "Lỗi xử lý dữ liệu từ server";
    }
  }

  async processBalanceRead(data) {
    try {
      // Xử lý dữ liệu đọc số dư từ thẻ
      this.state.scanningState = "success";
      this.cardData = {
        success: true,
        balance: data.message || 0,
        tid: data.tid || null,
        card_info: data.card_info || null,
        operation: "balance",
      };
      // Tự động đóng popup sau 3 giây
      setTimeout(() => {
        if (this.isComponentMounted) {
          this.confirm();
        }
      }, 3000);
    } catch (error) {
      console.error("Error processing balance read:", error);
      this.state.scanningState = "error";
      this.state.errorMessage = "Lỗi đọc số dư từ thẻ";
    }
  }

  async processCardRead(tid) {
    try {
      // Tìm kiếm partner theo card_tid
      const partners = await this.orm.searchRead(
        "res.partner",
        [["card_tid", "=", tid]],
        ["id", "name", "money", "currency_id"]
      );

      this.state.scanningState = "success";

      if (partners.length === 0) {
        this.cardData = {
          success: true,
          tid: tid,
          partner_found: false,
          operation: "read",
        };
      } else {
        const partner = partners[0];
        this.cardData = {
          success: true,
          partner_id: partner.id,
          partner_name: partner.name,
          partner_balance: partner.money,
          tid: tid,
          partner_found: true,
          operation: "read",
        };
      }

      // Tự động đóng popup sau 3 giây
      setTimeout(() => {
        if (this.isComponentMounted) {
          this.confirm();
        }
      }, 3000);
    } catch (error) {
      console.error("Error processing card read:", error);
      this.state.scanningState = "error";
      this.state.errorMessage = "Lỗi đọc thông tin thẻ";
    }
  }

  async processWriteOperation(data) {
    try {
      if (data.success || data.code === 201) {
        // Ghi thành công
        this.state.scanningState = "success";
        this.cardData = {
          success: true,
          written_data: this.props.data,
          current_money: data.message,
          operation: "write",
          tid: data.tid || null,
        };

        setTimeout(() => {
          if (this.isComponentMounted) {
            this.confirm();
          }
        }, 2000);
      } else {
        this.state.scanningState = "error";
        this.state.errorMessage = data.message || "Lỗi ghi dữ liệu lên thẻ";
      }
    } catch (error) {
      console.error("Error processing write operation:", error);
      this.state.scanningState = "error";
      this.state.errorMessage = "Lỗi xử lý ghi thẻ";
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
        operation: "payment",
      };

      // Tự động đóng popup sau 2 giây
      setTimeout(() => {
        if (this.isComponentMounted) {
          this.confirm();
          this.props.close();
        }
      }, 2000);
    } catch (error) {
      console.error("Error processing payment:", error);
      this.state.scanningState = "error";
      this.state.errorMessage = "Lỗi xử lý thanh toán";
    }
  }

  clearScanTimeout() {
    if (this.scanTimeout) {
      console.log("Clearing scanTimeout interval");
      clearInterval(this.scanTimeout);
      this.scanTimeout = null;
    }
  }

  confirm() {
    this.cleanup();
    // Gọi callback với kết quả
    if (this.props.onPaymentResult) {
      this.props.onPaymentResult(this.cardData || { success: true });
    }
  }

  cancel() {
    // Gọi callback với null để báo hiệu cancel
    if (this.props.onPaymentResult) {
      this.props.onPaymentResult(this.cardData || null);
    }
    this.cleanup();
    this.props.close();
  }

  cleanup() {
    console.log("Cleanup called, clearing all operations");
    this.isOperationActive = false;
    this.clearScanTimeout();

    if (this.processingTimeout) {
      clearTimeout(this.processingTimeout);
      this.processingTimeout = null;
    }

    if (this.cardDetectionTimeout) {
      clearTimeout(this.cardDetectionTimeout);
      this.cardDetectionTimeout = null;
    }
  }

  // Method để retry khi có lỗi
  retryCardOperation() {
    this.state.scanningState = "waiting";
    this.state.errorMessage = "";

    // Reset operation flag và debounce timer
    this.isOperationActive = false;
    this.lastOperationTime = 0;

    // Clear các timer cũ
    this.clearScanTimeout();

    // Bắt đầu operation lại
    if (this.webSocket && !this.webSocket.isDisconnect) {
      this.startCardOperation();
    } else {
      // Nếu WebSocket bị đóng, đăng ký lại callbacks và connect
      this.webSocket.onMessage(this.handleWebSocketMessage.bind(this));
      this.webSocket.onOpen(this.handleWebSocketOpen.bind(this));
      this.webSocket.connect();
    }
  }

  // Getter để lấy title phù hợp
  get popupTitle() {
    switch (this.state.operationType) {
      case "write":
        return "Nạp tiền vào thẻ";
      case "balance":
        return "Đọc số dư thẻ";
      case "payment":
        return "Thanh toán bằng thẻ";
      default:
        return "Đọc thông tin thẻ";
    }
  }

  get instructionText() {
    switch (this.state.operationType) {
      case "write":
        return "Đặt thẻ lên đầu đọc để nạp tiền";
      case "balance":
        return "Đặt thẻ lên đầu đọc để đọc số dư";
      case "payment":
        return "Đặt thẻ lên đầu đọc để thanh toán";
      default:
        return "Đặt thẻ lên đầu đọc để đọc thông tin";
    }
  }

  async getPayload() {
    return this.cardData;
  }
}
