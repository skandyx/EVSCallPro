
const express = require('express');
const os = require('os');
const router = express.Router();

// Mock function to simulate disk usage check
const checkDiskSpace = async () => {
    return {
        total: 50 * 1024 * 1024 * 1024, // 50 GB
        used: Math.floor(Math.random() * 40 + 10) * 1024 * 1024 * 1024, // 10-50 GB used
    };
};

/**
 * @openapi
 * /system/stats:
 *   get:
 *     summary: Récupère les statistiques de santé du système.
 *     tags: [Système]
 *     responses:
 *       200:
 *         description: Un objet contenant les statistiques du CPU, de la RAM, du disque, etc.
 */
router.get('/stats', async (req, res) => {
    try {
        const cpus = os.cpus();
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const disk = await checkDiskSpace();

        res.json({
            cpu: {
                brand: cpus[0].model,
                load: (Math.random() * 80 + 5).toFixed(1), // Simulate 5-85% load
            },
            ram: {
                total: totalMem,
                used: totalMem - freeMem,
            },
            disk: {
                total: disk.total,
                used: disk.used,
            },
            recordings: {
                size: Math.floor(Math.random() * 5 * 1024 * 1024 * 1024), // 0-5 GB
                files: Math.floor(Math.random() * 2000),
            }
        });
    } catch (error) {
        console.error("Error fetching system stats:", error);
        res.status(500).json({ error: "Failed to load system stats." });
    }
});

module.exports = router;
