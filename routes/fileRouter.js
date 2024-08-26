const { Router } = require('express');

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fileRouter = Router();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL,process.env.SUPABASE_APIKEY);



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
                updatedAt: new Date(),
            },
        });

        res.redirect('/');
        } catch (error) {
            console.error(error)
            res.status(500).send("Error editing file name");
    }
    }
});

fileRouter.get('/download/:userid/:parentid/:fileid', async (req,res) => {
    const currid = parseInt(req.user.id);
    const userid = parseInt(req.params.userid);
    const fileid = parseInt(req.params.fileid);
    const parentid = parseInt(req.params.parentid);
    if (currid !== userid) {
        return res.status(403).send(`Access denied, you don't have the permissions to access this file.`)
    } else {  
        try {
            const filename = await prisma.file.findUnique({where:{id:fileid}});

        const { data, error } = await supabase
            .storage
            .from('bdrive')
            .createSignedUrl(filename.url, 60);
        
            if (error) {
                console.error('Error generating signed url:', error);
                return res.status(500).send('Internal server error');
            }
            res.redirect(data.signedUrl);
        } catch (error) {
            console.error('Error processing the request:', error);
        res.status(500).send('Internal server error');
        }
    }

})

fileRouter.get('/delete/:userid/:fileid', async (req,res) => {
    const currid = parseInt(req.user.id);
    const userid = parseInt(req.params.userid);
    const fileid = parseInt(req.params.fileid);
    if (currid !== userid) {
        return res.status(403).send(`Access denied, you don't have the permissions to access this file.`)
    } else { 
        try {
            const file = await prisma.file.findUnique({where:{id:fileid}});

            const { data, error } = await supabase.storage.from('bdrive').remove([file.url]);

                if (error) {
                 console.error('Errore deleting file:', error);
                 return res.status(500).send('internal server error')
                } else {
                 console.log('File Deleted:', data.name);




            await prisma.file.delete({where: { id: fileid}})

           
                    res.redirect('/');
                
           }

        
        } catch (error) {
            console.error('Error deleting file:', error);
            res.status(500).send('Internal server error');
        }
    }
});

module.exports = fileRouter;
