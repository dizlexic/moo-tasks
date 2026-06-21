import { eventHandler } from 'h3'
import {getUserSessionCustom} from "../../lib/session";

export default eventHandler(async (event) => {
  const session = await getUserSessionCustom(event)
  return session
})
