# Part of Odoo. See LICENSE file for full copyright and licensing details.
import logging
from random import randrange
from pprint import pformat
from datetime import datetime, timedelta
import pytz

import psycopg2

from odoo import api, fields, models, tools, _, Command
from odoo.exceptions import ValidationError, UserError
from odoo.osv.expression import AND

_logger = logging.getLogger(__name__)  # Tạo logger để ghi lại thông tin


class PosOrder(models.Model):
    _inherit = 'pos.order'

    tid = fields.Char(string="Mẫ thẻ")
    
    def _process_saved_order(self, draft):
        result = super()._process_saved_order(draft)
        self.tid = self.env.context['tid']
        return result
       
    