"""自定义异常"""
from typing import Any


class AppException(Exception):
    """应用基础异常"""
    def __init__(self, message: str, status_code: int = 400, detail: Any = None):
        self.message = message
        self.status_code = status_code
        self.detail = detail


class NotFoundError(AppException):
    """资源不存在"""
    def __init__(self, message: str = "资源不存在"):
        super().__init__(message, status_code=404)


class UnauthorizedError(AppException):
    """未认证"""
    def __init__(self, message: str = "请先登录"):
        super().__init__(message, status_code=401)


class ForbiddenError(AppException):
    """无权限"""
    def __init__(self, message: str = "无权访问"):
        super().__init__(message, status_code=403)


class ProcessingError(AppException):
    """处理失败"""
    def __init__(self, message: str = "处理失败"):
        super().__init__(message, status_code=500)
