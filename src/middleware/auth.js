const alunoModel = require("../models/alunoModel")
const { novoErro, tratarMensagensDeErro } = require("../utils/erros");
const { resolve } = require("path")
const dotenv = require("dotenv").config({ path: resolve(__dirname, "../", "../", ".env") })
const { Sequelize } = require("sequelize")
const jwt = require("jsonwebtoken")

function validarDataToken(token) {

    return new Promise((resolve, reject) => {

        const tokenDecodificado = jwt.decode(token)

        if (!tokenDecodificado || !tokenDecodificado.exp) {
            reject("Token inválido", 403)  // Token inválido ou sem data de expiração
        }

        const dataExpiracaoToken = new Date(tokenDecodificado.exp * 1000)
        const dataAtual = new Date();

        if (dataExpiracaoToken < dataAtual) {
            reject("Token expirado", 403)
        }
        resolve(true)
    })
}

async function encontrarAlunoLogin(email, token) {

    // Se conecta usando um usuario q só tem acesso a uma view de login
    const sequelize_login = new Sequelize({
        database: process.env.database_name,
        username: process.env.database_user_root, // dps atualizar para o login funcionario
        password: process.env.database_password_root, // dps atualizar para o senha funcionario
        host: process.env.database_host,
        dialect: 'mysql'
    });

    const response = await alunoModel(sequelize_login).findOne({
        where: {
            email: email,
            token
        }
    })
    if (!!response == false) {
        novoErro("Usuario ou token inválidos, permissão negada.", 403)
    }
    return response
}

function criarConexaoBanco() {

    const sequelize = new Sequelize({
        database: process.env.database_name,
        username: process.env.database_user_aluno,
        password: process.env.database_password_aluno,
        host: process.env.database_host,
        dialect: 'mysql'
    });

    return sequelize

}

const authMiddleware = (req, res, next) => {
    // Faça a autenticação do usuário e obtenha as informações necessárias

    return new Promise(async (resolve, reject) => {

        try {
            const { email } = req.headers
            const token = req.headers.authorization.split(" ")[1]
            
            if (!!email == false || !!token == false) {
                novoErro("Usuario ou token inválidos, permissão negada", 403)
            }

            await validarDataToken(token)
            .catch((e)=> novoErro("Token inválido ou expirado", 403))

            const aluno = await encontrarAlunoLogin(email, token) // procura o funcionario no banco

            // const { usuarioBanco, senhaBanco } = definirPermissaoNoBanco(funcionario) // define a permissão dele de acordo com o banco

            const sequelize = criarConexaoBanco() // cria uma conexão no banco com o nivel da permissão

            //Autentica a conexão no banco de dados
            await sequelize.authenticate()
                .catch((e) => novoErro("Erro ao autenticar usuario do banco", 500))


            // Define o req.sequelize 
            req.sequelize = sequelize
            req.aluno = {email, token}
            // Prossiga para a próxima etapa da requisição
            next();
        }
        catch (err) {
            const erroTratado = await tratarMensagensDeErro(err)
            res.status(erroTratado.status).json({ errMsg: erroTratado.message, "statusCode": erroTratado.status })
        }

    })

};

module.exports = authMiddleware