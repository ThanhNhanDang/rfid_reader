import logging

from odoo import fields, models, api
_logger = logging.getLogger(__name__)


class ContactInherit(models.Model):
    _inherit = 'res.partner'

    def test_write_data(self):
        if self.env.context.get('uuid_client', False):
            self.env['bus.bus'].sudo()._sendone(
                self.env.context.get('uuid_client', False),
                'notification',
                {
                    "partner_id": self.id,
                    "data": str(20500)  # Không vượt quá 24 ký tự
                }
            )

    def test_read_data(self):
        if self.env.context.get('uuid_client', False):
            self.env['bus.bus'].sudo()._sendone(
                self.env.context.get('uuid_client', False),
                'read_card',
                {
                }
            )

    def done_write_data(self, current_money_in_card, add_money):
        if current_money_in_card and add_money:
            _logger.info("current_money_in_card: " +
                         current_money_in_card + " add_money: " + add_money + " " + self.display_name)

    def cancel_write_data(self):
       
        _logger.info("cancel " + self.display_name)
