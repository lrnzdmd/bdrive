const { Router } = require('express');
const { rm } = require('node:fs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fileRouter = Router();

fileRouter.post('/edit/:userid/:fileid', async (req,res) => {
    const fileid = parseInt(req.params.fileid);
    const userid = parseInt(req.params.userid);
    const currid = parseInt(req.user.id);
    if (currid != userid) {
        return res.status(403).send(`Access denied, you don't have the permissions to access this file.`)
    } else { 
        try {
        await prisma.file.update({
            where: {
                id: fileid,
            },
            data:{
                name: req.body.editname,
            },
        });

        res.redirect(req.get('Referer'));
        } catch (error) {
            console.error(error)
            res.status(500).send("Error editing file name");
    }
    }
});

fileRouter.get('/delete/:userid/:fileid', async (req,res) => {
    const fileid = parseInt(req.params.fileid);
    const userid = parseInt(req.params.userid);
    const currid = parseInt(req.user.id);
    if (currid != userid) {
        return res.status(403).send(`Access denied, you don't have the permissions to access this file.`)
    } else { 
        try {
            const file = await prisma.file.findUnique({
                where: {
                    id: fileid,
                },
            });

            rm(file.url, (err) => {
                if (err) {
                    return res.status(500).send("Internal server error - error deleting file")
                }
            })

            await prisma.file.delete({
                where:{
                    id: fileid,
                },
            });


            res.redirect(req.get('Referer'));

        } catch (error) {
            console.error(error);
            return res.status(500).send("Internal server error - error deleting file");
        }

    }
});

module.exports = fileRouter;
