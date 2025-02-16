
import { Router } from 'express';
import { requireAuth } from '../auth';

const router = Router();

router.get('/status', (req, res) => {
  console.log('Session:', req.session);
  if (req.session && req.session.userId && req.session.isAdmin) {
    res.json({
      authenticated: true,
      username: req.session.username,
      userId: req.session.userId,
      isAdmin: true
    });
  } else {
    res.json({
      authenticated: false,
      isAdmin: false,
      message: 'No active session or not an admin'
    });
  }
});

export default router;
