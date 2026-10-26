-- AddColumn: полная цепочка X-Forwarded-For (адрес за NAT)
ALTER TABLE "LoginEvent" ADD COLUMN "forwardedFor" TEXT;