import {
    ApolloClient,
    ApolloLink,
    InMemoryCache,
    Observable,
} from '@apollo/client'

// Board's components call useQuery/useMutation unconditionally, so they need
// an ApolloProvider. The embed has no backend: every network path is gated off
// by `features.network`, and this client is the backstop — any operation that
// still slips through resolves to an empty result without touching the network.
export function createOfflineApolloClient(): ApolloClient<unknown> {
    const offlineLink = new ApolloLink(
        () =>
            new Observable((observer) => {
                observer.next({ data: null })
                observer.complete()
            })
    )
    return new ApolloClient({
        link: offlineLink,
        cache: new InMemoryCache(),
    }) as ApolloClient<unknown>
}
