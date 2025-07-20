{
    'name': 'RFID READER POS Odoo 18.0',
    'version': '1.0',
    'category': '1. MixDD POS',
    "author": "Đặng Thành Nhân",
    'sequence': 0,
    'description': '',
    'depends': ["point_of_sale", "stock", "product", "web", "bus"],
    'installable': True,
    'auto_install': True,
    'application': False,
    'data':
        [
        "views/res_partner_test.xml",
    ],
    'assets': {
        'point_of_sale._assets_pos': [
            'rfid_reader/static/src/xml/pos/**/*',
            'rfid_reader/static/src/js/pos/**/*',
        ],
        'web.assets_backend': [
            'rfid_reader/static/src/js/backend/**/*',
            'rfid_reader/static/src/css/backend/**/*',
            'rfid_reader/static/src/js/share/**/*',
            'rfid_reader/static/src/xml/backend/**/*',
        ],
    },
    'license': 'LGPL-3',
}
