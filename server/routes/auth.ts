
import { Router } from 'express';
import { requireAuth } from '../auth';

const router = Router();

router.get('/status', (req, res) => {
  if (req.session.userId) {
    res.json({
      authenticated: true,
      username: req.session.username
    });
  } else {
    res.status(401).json({
      authenticated: false
    });
  }
});

export default router;
