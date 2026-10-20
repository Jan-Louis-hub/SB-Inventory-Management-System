class BaseConfig:
    SECRET_KEY = None
    SQLALCHEMY_DATABASE_URI = None
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    JSON_SORT_KEYS = False


class DevelopmentConfig(BaseConfig):
    DEBUG = True
    SECRET_KEY = "development-only-insecure-key"
    SQLALCHEMY_DATABASE_URI = "sqlite:///inventory.db"


class ProductionConfig(BaseConfig):
    DEBUG = False


class TestingConfig(BaseConfig):
    TESTING = True
    SECRET_KEY = "test-only-key"
    SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:"


CONFIGS = {
    "development": DevelopmentConfig,
    "production": ProductionConfig,
    "testing": TestingConfig,
}
