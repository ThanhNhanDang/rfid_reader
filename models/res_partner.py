import logging

from odoo import fields, models, api,_
_logger = logging.getLogger(__name__)


class ContactInherit(models.Model):
    _inherit = 'res.partner'
    card_tid = fields.Char(string="Mã thẻ")
    money = fields.Monetary(
        string="Tiền trong ví",
        store=True,
        currency_field='currency_id',
    )
    def test_write_data(self):
        return {
            'name': _('Nạp tiền'),
            'type': 'ir.actions.act_window',
            'res_model': 'pos.input.money.wizard',
            'view_mode': 'form',
            'target': 'new',
            'context':{'default_partner_id':self.id}
        }

    def test_read_data(self):
        if self.env.context.get('uuid_client', False):
            self.env['bus.bus'].sudo()._sendone(
                self.env.context.get('uuid_client', False),
                'notification',
                {
                    "type":"balance",
                }
            )

    def test_read_tid_data(self):
        if self.env.context.get('uuid_client', False):
            self.env['bus.bus'].sudo()._sendone(
                self.env.context.get('uuid_client', False),
                'notification',
                {
                    "type":"read",
                }
            )

    def done_write_data(self, current_money_in_card, add_money):
        if current_money_in_card and add_money:
            self.money = self.money + int(add_money)
            _logger.info("current_money_in_card: " +
                         current_money_in_card + " add_money: " + add_money + " " + self.display_name)

    def cancel_write_data(self):
       
        _logger.info("cancel " + self.display_name)
