import 'express-async-errors'
import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import { rateLimit } from 'express-rate-limit'

import { env } from './config/env'
import { logger } from './shared/utils/logger'
import { errorHandler } from './shared/middleware/errorHandler'
import { notFoundHandler } from './shared/middleware/notFoundHandler'

import { authRouter } from './modules/auth/auth.routes'
import { organizationsRouter } from './modules/organizations/organizations.routes'
import { usersRouter } from './modules/users/users.routes'
import { facilitiesRouter } from './modules/facilities/facilities.routes'
import { cyclesRouter } from './modules/cycles/cycles.routes'
import { requirementsRouter } from './modules/requirements/requirements.routes'
import { evidencesRouter } from './modules/evidences/evidences.routes'
import { actionPlanRouter } from './modules/action-plan/action-plan.routes'
import { academyRouter } from './modules/academy/academy.routes'
import { notificationsRouter } from './modules/notifications/notifications.routes'
import { reportsRouter } from './modules/reports/reports.routes'
import { dashboardRouter } from './modules/dashboard/dashboard.routes'

const app = express()

app.use(helmet())
app.use(cors({ origin: env.FRONTEND_URL, credentials: true, methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'], allowedHeaders: ['Content-Type','Authorization'] }))
app.use(rateLimit({ windowMs: env.RATE_LIMIT_WINDOW_MS, max: env.RATE_LIMIT_MAX, standardHeaders: true, legacyHeaders: false }))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))
app.use(morgan('combined', { stream: { write: (msg) => logger.http(msg.trim()) } }))

app.get('/health', (req, res) => res.json({ status: 'ok', version: '1.0.0', timestamp: new Date().toISOString() }))

const v1 = '/v1'
app.use(`${v1}/auth`, authRouter)
app.use(`${v1}/organizations`, organizationsRouter)
app.use(`${v1}/users`, usersRouter)
app.use(`${v1}/facilities`, facilitiesRouter)
app.use(`${v1}/cycles`, cyclesRouter)
app.use(`${v1}/cycles`, requirementsRouter)
app.use(`${v1}/evidences`, evidencesRouter)
app.use(`${v1}`, actionPlanRouter)
app.use(`${v1}/academy`, academyRouter)
app.use(`${v1}/notifications`, notificationsRouter)
app.use(`${v1}/reports`, reportsRouter)
app.use(`${v1}/dashboard`, dashboardRouter)

app.use(notFoundHandler)
app.use(errorHandler)

app.listen(env.PORT, () => {
  logger.info(`🚀 HIDROBR GISTM API em http://localhost:${env.PORT}`)
  logger.info(`📋 Ambiente: ${env.NODE_ENV}`)
})

export default app
