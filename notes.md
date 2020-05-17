TX-1:
    install aggregator(assume counterfactual address '0')
    create permission [aggregator, ADD_POWER_SOURCE_ROLE, sabVoting, sabVoting]
    create permission [aggregator, MANAGE_POWER_SOURCE_ROLE, sabVoting, sabVoting]
    create permission [aggregator, MANAGE_WEIGHTS_ROLE, sabVoting, sabVoting]
    exec aggregator addPowerSource(comToken,1,1)

Tx-2:
    install inboxVoting(assume counterfactual address '0')
    create permission [comManager, CREATE_VOTES_ROLE, sabVoting, sabVoting]
    create permission [inboxVoting, MODIFY_SUPPORT_ROLE, sabVoting, sabVoting]
    create permission [inboxVoting, MODIFY_QUORUM_ROLE, sabVoting, sabVoting]

```bash
f='--env aragon:rinkeby --use-frame'
dao=0x026458457372841C80e44A5B016fc015f45d2355
acl=0x9c1365074c0919e590bb23fe2df70f20fc8cbd3e
sabManager=0x003706e1c4884d70ed2a8804a2439ab2531f2797
sabVoting=0xb4b771fd43d5d3d885ff8334e03617143d6b9641
finance=0xdaebc815bc7cd9ceac70d207f496fec629973432
com=0x7Af1a0450531912d11B6F1761CB23260523B100a
comManager=0x040E6D2DC0F160EaAC8Fc21415987C4e741d33A3
```

```bash
dao token new "Community" "COMMUNITY" $f
dao install $dao token-manager --app-init none $f

dao token change-controller $com $comManager $f
dao acl create $dao $comManager MINT_ROLE $sabVoting $sabVoting $f
dao exec $dao $comManager initialize $com true 0 $f
dao install $dao Inboc --app-init-args 'Inbox' 'INBOX' 18 $f

dao install $dao voting --app-init-args $aggregator 250000000000000000 10000000000000000 86400 $f
```