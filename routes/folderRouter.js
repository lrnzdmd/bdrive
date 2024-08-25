const { Router } = require('express');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const folderRouter = Router();


folderRouter.post('/edit/:userid/:folderid', async (req,res) => {
    const folderid = parseInt(req.params.folderid);
    const userid = parseInt(req.params.userid);
    const currid = parseInt(req.user.id);
    if (currid != userid) {
        return res.status(403).send(`Access denied, you don't have the permissions to access this folder.`)
    } else { 
        try {
        await prisma.folder.update({
            where: {
                id: folderid,
            },
            data:{
                name: req.body.editname,
            },
        });

        res.redirect(req.get('Referer'));
        } catch (error) {
            res.status(500).send("Error editing folder name");
    }
    }
})


folderRouter.get('/delete/:userid/:folderid', async (req,res) => {
    const folderid = parseInt(req.params.folderid);
    const userid = parseInt(req.params.userid);
    const currid = parseInt(req.user.id);
    if (currid != userid) {
        return res.status(403).send(`Access denied, you don't have the permissions to access this folder.`)
    } else { 
        try {
        
            await prisma.folder.delete({
                where:{
                    id: folderid,
                },
            });


            res.redirect(req.get('Referer'));

        } catch (error) {
            console.error(error);
            return res.status(500).send("Internal server error - error deleting folder");
        }

    }
})












module.exports = folderRouter;