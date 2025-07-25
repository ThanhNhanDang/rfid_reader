import logging

import hmac
import hashlib
import urllib.parse

from odoo import _, api, fields, models

_logger = logging.getLogger(__name__)

class PosPaymentMethod(models.Model):
    _inherit = "pos.payment.method"
    pricelist_id = fields.Many2one('product.pricelist',"Bảng giá")