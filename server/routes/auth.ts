
import { Router } from 'express';
import { requireAuth } from '../auth';

const router = Router();

router.get('/status', (req, res) => {
  console.log('Session:', req.session);
  if (req.session && req.session.userId) {
    res.json({
      authenticated: true,
      username: req.session.username,
      userId: req.session.userId
    });
  } else {
    res.json({
      authenticated: false,
      message: 'No active session'
    });
  }
});

export default router;
