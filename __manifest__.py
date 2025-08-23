{
    'name': 'RFID READER POS Odoo 18.0',
    'version': '1.0',
    'category': '1. MixDD POS',
    "author": "Đặng Thành Nhân",
    'sequence': 0,
    'description': '',
    'depends': ["point_of_sale", "stock", "product", "web", "bus", "base"],
    'installable': True,
    'auto_install': True,
    'application': False,
    'data':
        [
        'security/ir.model.access.csv',
        "views/res_partner.xml",
        "views/pos_input_money_wizard.xml",
        "views/pos_order.xml",
    ],
    'assets': {
        'point_of_sale._assets_pos': [
            'rfid_reader/static/src/xml/pos/**/*',
            'rfid_reader/static/src/js/pos/**/*',
            'rfid_reader/static/src/js/share/**/*',
            'rfid_reader/static/src/xml/share/**/*',

        ],
        'web.assets_backend': [
            'rfid_reader/static/src/js/share/**/*',
            'rfid_reader/static/src/xml/share/**/*',
            'rfid_reader/static/src/js/backend/**/*',
            'rfid_reader/static/src/css/backend/**/*',
            'rfid_reader/static/src/xml/backend/**/*',
        ],
        'web.assets_common': [
            'rfid_reader/static/src/share/**/*',
        ]
    },
    'license': 'LGPL-3',
}
