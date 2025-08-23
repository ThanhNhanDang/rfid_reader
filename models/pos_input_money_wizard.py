import requests
import json
import logging
from datetime import datetime
from odoo import models, fields, api, tools, _
from odoo.tools import format_amount
from odoo.exceptions import UserError, ValidationError
import threading
import time

_logger = logging.getLogger(__name__)

class PosInputMoneyWizard(models.TransientModel):
    _name = 'pos.input.money.wizard'
    _description = 'POS Input Money Wizard'
    partner_id = fields.Many2one('res.partner')
    currency_id = fields.Many2one('res.currency', string='Tiền tệ', default=lambda self: self.env.company.currency_id.id)
    money = fields.Integer(
        string="Số tiền nạp",
        store=True,
    )
   
    def test_write_data(self):
        if self.env.context.get('uuid_client', False):
            self.env['bus.bus'].sudo()._sendone(
                self.env.context.get('uuid_client', False),
                'notification',
                {
                    "type":"write",
                    "partner_id": self.partner_id.id,
                    "data": str(self.money)  # Không vượt quá 24 ký tự
                }
            )