/** @odoo-module **/
import { NavBar } from "@web/webclient/navbar/navbar";
import { useService } from "@web/core/utils/hooks";
import { registry } from "@web/core/registry";
import { patch } from "@web/core/utils/patch";
import { UserMenu } from "@web/webclient/user_menu/user_menu";
import { onWillStart, useState, onMounted, onWillUnmount } from "@odoo/owl";
import { user } from "@web/core/user";
import { CardPaymentPopup } from "../share/card_payment_popup";

patch(NavBar.prototype, {
  setup() {
    super.setup(...arguments);

    this.dialog = useService("dialog");
    this.orm = useService("orm");

    this.uuidClient = this.generateUniqueString();
    localStorage.setItem("uuid_client", this.uuidClient);
    console.log(this.env.services.bus_service);
    this.env.services.bus_service.addChannel(this.uuidClient);
    this.env.services.bus_service.subscribe("notification", (event) => {
      if (event.type == "write") this.openCarPopup(event);
      else {
        this.openCard(event, event.type);
      }
    });
    onWillStart(async () => {});
    onWillUnmount(() => {
      this.env.services.bus_service.deleteChannel(this.uuidClient);
    });
  },
  async openCarPopup(event) {
    console.log("=============receive================", event);
    this.dialog.add(
      CardPaymentPopup,
      {
        type: "write",
        data: event.data,
        onPaymentResult: async (result) => {
          if (result && result.success) {
            console.log("Ghi thẻ thành công:", result);
            await this.orm.call(
              "res.partner",
              "done_write_data",
              [event.partner_id, result.current_money, result.written_data],
              {}
            );
          }
        },
      },
      {
        onClose: async () => {
          await this.orm.call(
            "res.partner",
            "cancel_write_data",
            [event.partner_id],
            {}
          );
        },
      }
    );
  },

  async openCard(event, type) {
    console.log("=============receive================", event);
    this.dialog.add(
      CardPaymentPopup,
      {
        type: type,
      },
      {
        onClose: async () => {},
      }
    );
  },

  generateUniqueString() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  },
});
