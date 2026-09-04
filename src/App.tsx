import React, { Component, useEffect, useState } from 'react'
import { Routes, Route, BrowserRouter } from 'react-router-dom'

import {
    ApolloClient,
    ApolloProvider,
    InMemoryCache,
    HttpLink,
    split,
    useMutation,
} from '@apollo/client'
import { setContext } from '@apollo/client/link/context'
import { getMainDefinition } from '@apollo/client/utilities'
import { WebSocketLink } from '@apollo/client/link/ws'

import BoardViewContainer from './views/Board'
import HomePageViewContainer from './views/Home'
import SupportViewContainer from './views/Support'
import PrivacyViewContainer from './views/Privacy'
import EmbeddableViewContainer from './views/Embeddable'
import CraftbaseLoader from './components/common/craftbaseLoader'

import routes from './routes'
import { INSERT_USER_ONE } from './schema/mutations'
import { generateRandomUsernames } from './utils/misc'

import './App.css'

import './common.css'

function getApolloClient() {
    const accessToken = localStorage.getItem('access_token')
    // console.log('access_token in client', accessToken)
    // const httpLink = new HttpLink({
    //     uri: import.meta.env.VITE_GRAPHQL_ENDPOINT,
    //     headers: {
    //         authorization: `Bearer ${accessToken}`,
    //         'content-type': 'application/json',
    //     },
    // })
    const httpLink = new HttpLink({
        uri: import.meta.env.VITE_GRAPHQL_ENDPOINT,
        headers: {
            // authorization: `Bearer ${accessToken}`,
            'content-type': 'application/json',
            'x-hasura-admin-secret': import.meta.env.VITE_HASURA_ADMIN_SECRET,
        },
    })

    const wsLink = new WebSocketLink({
        uri: import.meta.env.VITE_WS_GRAPHQL_ENDPOINT,

        options: {
            reconnect: true,
            connectionParams: () => {
                const userId = localStorage.getItem('userId')
                return {
                    headers: {
                        'content-type': 'application/json',
                        'x-hasura-admin-secret': import.meta.env
                            .VITE_HASURA_ADMIN_SECRET,
                        'x-hasura-role': 'user',
                        ...(userId ? { 'x-hasura-user-id': userId } : {}),
                    },
                }
            },
        },
    })

    const authLink = setContext((operation, { headers }) => {
        const userId = localStorage.getItem('userId')
        const isUserInsert = operation.operationName === 'insertUser'

        if (!userId && !isUserInsert) {
            console.error(
                '[Apollo] x-hasura-user-id is missing for operation:',
                operation.operationName
            )
        }

        return {
            headers: {
                ...headers,
                'x-hasura-role': 'user',
                ...(userId ? { 'x-hasura-user-id': userId } : {}),
            },
        }
    })

    // The split function takes three parameters:
    //
    // * A function that's called for each operation to execute
    // * The Link to use for an operation if the function returns a "truthy" value
    // * The Link to use for an operation if the function returns a "falsy" value
    const splitLink = split(
        ({ query }) => {
            const definition = getMainDefinition(query)
            return (
                definition.kind === 'OperationDefinition' &&
                definition.operation === 'subscription'
            )
        },
        wsLink,
        authLink.concat(httpLink)
    )

    const client = new ApolloClient({
        link: splitLink,
        cache: new InMemoryCache(),
    })
    return client
}

const apolloClient = getApolloClient()

function AppInit({ children }: { children: React.ReactNode }) {
    const [userReady, setUserReady] = useState(
        () => !!localStorage.getItem('userId')
    )
    const [insertUser] = useMutation(INSERT_USER_ONE)

    useEffect(() => {
        if (!userReady) {
            const { nickname, firstName, lastName } = generateRandomUsernames()
            insertUser({
                variables: { object: { nickname, firstName, lastName } },
            }).then(({ data }) => {
                if (data?.user?.id) {
                    localStorage.setItem('userId', data.user.id)
                    setUserReady(true)
                }
            })
        }
    }, [])

    if (!userReady) return <CraftbaseLoader />

    return <>{children}</>
}

class App extends Component {
    constructor(props: object) {
        super(props)
    }

    override render() {
        return (
            <BrowserRouter>
                <ApolloProvider client={apolloClient}>
                    <AppInit>
                        <div className="App ">
                            <Routes>
                                <Route
                                    path={routes.index}
                                    element={
                                        <BoardViewContainer welcomeSketch />
                                    }
                                />
                                <Route
                                    path={routes.board}
                                    element={<BoardViewContainer />}
                                />
                                <Route
                                    path={routes.marketing}
                                    element={<HomePageViewContainer />}
                                />
                                <Route
                                    path={routes.support}
                                    element={<SupportViewContainer />}
                                />
                                <Route
                                    path={routes.privacy}
                                    element={<PrivacyViewContainer />}
                                />
                                <Route
                                    path={routes.embeddable}
                                    element={<EmbeddableViewContainer />}
                                />
                            </Routes>
                        </div>
                    </AppInit>
                </ApolloProvider>
            </BrowserRouter>
        )
    }
}

export default App
