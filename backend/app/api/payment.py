"""支付 API — 订单创建、模拟支付、订单查询"""
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.models import User, PaymentOrder
from app.core.schemas import (
    PaymentOrderCreate, PaymentOrderOut,
    PaymentConfirmResponse, UserOut,
)
from app.api.auth import get_current_user

router = APIRouter(prefix="/api/payment", tags=["支付"])

# 价格定义
PLAN_PRICES = {
    "monthly": "19.90",
    "lifetime": "299.00",
}


@router.post("/orders", response_model=PaymentOrderOut)
async def create_order(
    data: PaymentOrderCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """创建支付订单"""
    if user.is_premium and user.premium_type == "lifetime":
        raise HTTPException(status_code=400, detail="您已是终身会员，无需再次购买")

    if user.is_premium and user.premium_type == "monthly" and data.plan == "monthly":
        raise HTTPException(status_code=400, detail="您当前已是月购会员，可续费或升级为终身会员")

    amount = PLAN_PRICES.get(data.plan, "0")
    order = PaymentOrder(
        user_id=user.id,
        plan=data.plan,
        amount=amount,
        status="pending",
    )
    db.add(order)
    await db.commit()
    await db.refresh(order)

    return PaymentOrderOut.model_validate(order)


@router.post("/orders/{order_id}/pay", response_model=PaymentConfirmResponse)
async def pay_order(
    order_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """模拟支付 — 确认支付并升级会员"""
    result = await db.execute(
        select(PaymentOrder).where(
            PaymentOrder.id == order_id,
            PaymentOrder.user_id == user.id,
        )
    )
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="订单不存在")
    if order.status != "pending":
        raise HTTPException(status_code=400, detail="订单状态异常，无法支付")

    # 更新订单状态
    order.status = "paid"
    order.paid_at = datetime.utcnow()

    # 升级用户会员
    user.is_premium = 1
    user.premium_type = order.plan

    if order.plan == "monthly":
        # 如果已有会员且未过期，则叠加时间
        base = datetime.utcnow()
        if user.premium_expire_at and user.premium_expire_at > base:
            base = user.premium_expire_at
        user.premium_expire_at = base + timedelta(days=30)
    else:  # lifetime
        user.premium_expire_at = None

    await db.commit()
    await db.refresh(order)

    msg = (
        f"终身会员已开通，永久有效" if order.plan == "lifetime"
        else f"月购会员已开通，有效期至 {user.premium_expire_at.strftime('%Y-%m-%d')}"
    )
    return PaymentConfirmResponse(
        user=UserOut.model_validate(user),
        order=PaymentOrderOut.model_validate(order),
        message=msg,
    )


@router.get("/orders", response_model=list[PaymentOrderOut])
async def list_orders(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """查询当前用户的支付订单"""
    result = await db.execute(
        select(PaymentOrder)
        .where(PaymentOrder.user_id == user.id)
        .order_by(PaymentOrder.created_at.desc())
    )
    orders = result.scalars().all()
    return [PaymentOrderOut.model_validate(o) for o in orders]
