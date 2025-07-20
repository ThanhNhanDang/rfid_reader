/** @odoo-module **/

import { registry } from "@web/core/registry";
import { _t } from "@web/core/l10n/translation";

export const webSocketService = {
  dependencies: ["notification", "dialog"],
  start(env, { notification, dialog }) {
    let websocket;
    let checkInterval;
    let checkTimeout;
    let onOpenCallback;
    let messageCallback;
    let isDisconnect = false;

    function connect() {
      if (isDisconnect) return;
      const wsUri = "ws://localhost:62536";
      
      try {
        websocket = new WebSocket(wsUri);
      } catch (error) {
        console.error("WebSocket connection error:", error);
        setTimeout(connect, 1000);
        return;
      }

      websocket.onopen = function () {
        notification.add(_t("Kết nối thành công"), {
          type: "success",
        });
        websocket.send("GetConnect");
        
        if (onOpenCallback) {
          onOpenCallback();
        }
      };

      websocket.onmessage = function (event) {
        if (messageCallback) {
          messageCallback(event);
        }
      };

      websocket.onclose = function (e) {
        if (!isDisconnect) {
          checkTimeout = setTimeout(connect, 1000);
        }
      };

      websocket.onerror = function (error) {
        console.error("WebSocket error:", error);
      };
    }

    return {
      connect: () => {
        isDisconnect = false;
        connect();
      },
      
      disconnect: () => {
        isDisconnect = true;
        
        // Clear timeouts
        if (checkTimeout) {
          clearTimeout(checkTimeout);
          checkTimeout = null;
        }
        
        // Clear intervals
        if (checkInterval) {
          clearInterval(checkInterval);
          checkInterval = null;
        }
        
        // Clear callbacks
        messageCallback = null;
        onOpenCallback = null;
        
        // Close websocket connection
        if (websocket) {
          websocket.onopen = null;
          websocket.onmessage = null;
          websocket.onclose = null;
          websocket.onerror = null;
          
          if (websocket.readyState === WebSocket.OPEN || 
              websocket.readyState === WebSocket.CONNECTING) {
            websocket.close();
          }
          
          websocket = null;
        }
      },
      
      send: (message) => {
        if (websocket && websocket.readyState === WebSocket.OPEN) {
          websocket.send(message);
        } else {
          console.warn("WebSocket is not open. Message not sent.");
        }
      },
      
      onMessage: (callback) => {
        messageCallback = callback;
      },
      
      onOpen: (callback) => {
        onOpenCallback = callback;
      },
      
      isConnect: () => {
        return websocket ? websocket.readyState : WebSocket.CLOSED;
      },
      
      get isDisconnect() {
        return isDisconnect;
      }
    };
  },
};

registry.category("services").add("webSocket", webSocketService);