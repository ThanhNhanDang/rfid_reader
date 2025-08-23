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
    let isConnecting = false; // Thêm flag để tránh multiple connections

    function connect() {
      if (isDisconnect || isConnecting) return;
      
      isConnecting = true;
      const wsUri = "ws://localhost:62536";
      
      try {
        websocket = new WebSocket(wsUri);
      } catch (error) {
        console.error("WebSocket connection error:", error);
        isConnecting = false;
        setTimeout(connect, 1000);
        return;
      }

      websocket.onopen = function () {
        isConnecting = false;
        notification.add(_t("Kết nối thành công"), {
          type: "success",
        });
        
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
        isConnecting = false;
        if (!isDisconnect) {
          console.log("WebSocket connection closed, attempting to reconnect...");
          checkTimeout = setTimeout(connect, 1000);
        }
      };

      websocket.onerror = function (error) {
        isConnecting = false;
        console.error("WebSocket error:", error);
        if (websocket.readyState !== WebSocket.CLOSED) {
          websocket.close();
        }
      };
    }

    return {
      connect: () => {
        isDisconnect = false;
        connect();
      },
      
      disconnect: () => {
        isDisconnect = true;
        isConnecting = false;
        
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
          return true;
        } else {
          console.warn("WebSocket is not open. Message not sent:", message);
          return false;
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
      },
      
      get isConnecting() {
        return isConnecting;
      }
    };
  },
};

registry.category("services").add("webSocket", webSocketService);